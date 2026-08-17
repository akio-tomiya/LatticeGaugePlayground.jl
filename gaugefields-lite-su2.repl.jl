const WEB_RNG_MODULUS = Int64(2147483647)
const WEB_RNG_MULTIPLIER = Int64(48271)
const WEB_RNG_MASK = Int64(4294967295)

function _web_rng_next(state::Int64)
    next_state = xor(state, (state << 13) & WEB_RNG_MASK)
    next_state = xor(next_state, next_state >> 17)
    return xor(next_state, (next_state << 5) & WEB_RNG_MASK)
end

function web_rng_state(seed::Integer)
    if seed < 0
        throw(ArgumentError("seed must be nonnegative"))
    end
    return Int64[mod(Int64(seed), WEB_RNG_MASK) + 1]
end

function restore_web_rng_state(value::Integer)
    state = Int64(value)
    if state <= 0 || state > WEB_RNG_MASK
        throw(ArgumentError("web RNG state must be in 1:$WEB_RNG_MASK"))
    end
    return Int64[state]
end

function web_rand!(state::Vector{Int64})
    if length(state) != 1 || state[1] <= 0 || state[1] > WEB_RNG_MASK
        throw(ArgumentError("web RNG state must contain one valid integer"))
    end
    next_state = _web_rng_next(state[1])
    state[1] = next_state
    return (next_state - 1) / Float64(WEB_RNG_MASK)
end

function web_standard_normal_pair!(state::Vector{Int64})
    first_uniform = web_rand!(state)
    while first_uniform <= 0.0
        first_uniform = web_rand!(state)
    end
    radius = sqrt(-2.0 * log(first_uniform))
    angle = 2.0 * pi * web_rand!(state)
    return radius * cos(angle), radius * sin(angle)
end

# Audited specialization of Gaugefields.jl portable heatbath kernel blob:
# fe6a13d0503662918fe892ec01aa2c71e8e7cfcc
const FAST_WEB_CHUNK_SCHEMA_VERSION = 1.0

const FAST_WEB_SESSION_SCHEMA_VERSION = 2.0

const FAST_WEB_CHUNK_HEADER_LENGTH = 19


function _fast_web_validate_algorithm(
    algorithm::String,
    nx::Int64,
    ny::Int64,
    nz::Int64,
    nt::Int64,
)
    if algorithm != "metropolis" && algorithm != "heatbath"
        throw(ArgumentError("algorithm must be metropolis or heatbath"))
    end
    if algorithm == "heatbath" && (nx <= 1 || ny <= 1 || nz <= 1 || nt <= 1)
        throw(ArgumentError("heatbath requires every lattice extent to exceed one"))
    end
    return algorithm
end


function _fast_web_uniform_state(state::Int64, inverse_scale::Float64)
    state = xor(state, (state << 13) & WEB_RNG_MASK)
    state = xor(state, state >> 17)
    state = xor(state, (state << 5) & WEB_RNG_MASK)
    return state, (state - 1) * inverse_scale
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_web_haar_su2_state(state::Int64, inverse_scale::Float64)
    while true
        state, first_draw = _fast_web_uniform_state(state, inverse_scale)
        state, second_draw = _fast_web_uniform_state(state, inverse_scale)
        first = 2.0 * first_draw - 1.0
        second = 2.0 * second_draw - 1.0
        first_radius = first * first + second * second
        if first_radius >= 1.0 || first_radius == 0.0
            continue
        end
        state, third_draw = _fast_web_uniform_state(state, inverse_scale)
        state, fourth_draw = _fast_web_uniform_state(state, inverse_scale)
        third = 2.0 * third_draw - 1.0
        fourth = 2.0 * fourth_draw - 1.0
        second_radius = third * third + fourth * fourth
        if second_radius >= 1.0 || second_radius == 0.0
            continue
        end
        scale = sqrt((1.0 - first_radius) / second_radius)
        return state, first, second, third * scale, fourth * scale
    end
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_web_kennedy_pendleton_state(
    state::Int64,
    k::Float64,
    inverse_scale::Float64,
)
    if k <= 1.0e-14
        return _fast_web_haar_su2_state(state, inverse_scale)
    end
    for attempt in 1:100_000
        state, first = _fast_web_uniform_state(state, inverse_scale)
        while first <= 0.0
            state, first = _fast_web_uniform_state(state, inverse_scale)
        end
        state, second = _fast_web_uniform_state(state, inverse_scale)
        while second <= 0.0
            state, second = _fast_web_uniform_state(state, inverse_scale)
        end
        state, angle_draw = _fast_web_uniform_state(state, inverse_scale)
        state, acceptance_draw = _fast_web_uniform_state(state, inverse_scale)
        x = -log(first) / k
        xp = -log(second) / k
        cosine = cos(2.0 * pi * angle_draw)
        delta = xp + x * cosine * cosine
        if acceptance_draw * acceptance_draw > 1.0 - 0.5 * delta
            continue
        end
        a0 = 1.0 - delta
        radius = sqrt(max(0.0, 1.0 - a0 * a0))
        state, phi_draw = _fast_web_uniform_state(state, inverse_scale)
        state, theta_draw = _fast_web_uniform_state(state, inverse_scale)
        phi = 2.0 * pi * phi_draw
        cos_theta = 2.0 * theta_draw - 1.0
        sin_theta = sqrt(max(0.0, 1.0 - cos_theta * cos_theta))
        return (
            state,
            a0,
            radius * cos(phi) * sin_theta,
            radius * sin(phi) * sin_theta,
            radius * cos_theta,
        )
    end
    throw(ErrorException("Kennedy-Pendleton heatbath failed"))
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_web_validate_chunk_sweeps(chunk_sweeps)
    if chunk_sweeps < 0
        throw(ArgumentError("chunk_sweeps must be nonnegative"))
    end
    return chunk_sweeps
end


function _fast_web_copy_frame!(frames, frame_offset, frame_size, slice_buffer)
    for index in 1:frame_size
        frames[frame_offset + index] = slice_buffer[index]
    end
    return frames
end


function _fast_web_encode_session_chunk(
    nc,
    nx,
    ny,
    nz,
    nt,
    chunk_sweeps,
    include_configuration,
    completed_sweeps,
    final_plaquette,
    final_polyakov_real,
    final_polyakov_imag,
    total_accepted,
    total_offered,
    width,
    height,
    rng_state,
    plaquette_history,
    polyakov_real_history,
    polyakov_imag_history,
    acceptance_history,
    frames,
    configuration,
)
    output_length = FAST_WEB_CHUNK_HEADER_LENGTH +
                    4 * chunk_sweeps +
                    length(frames) +
                    length(configuration)
    output = Vector{Float64}(undef, output_length)
    output[1] = include_configuration ? FAST_WEB_CHUNK_SCHEMA_VERSION :
                FAST_WEB_SESSION_SCHEMA_VERSION
    output[2] = nc
    output[3] = nx
    output[4] = ny
    output[5] = nz
    output[6] = nt
    output[7] = chunk_sweeps
    output[8] = completed_sweeps
    output[9] = final_plaquette
    output[10] = final_polyakov_real
    output[11] = final_polyakov_imag
    output[12] = total_offered == 0 ? 0.0 : total_accepted / total_offered
    output[13] = total_accepted
    output[14] = total_offered
    output[15] = width
    output[16] = height
    output[17] = chunk_sweeps + 1
    output[18] = rng_state
    output[19] = length(configuration)
    cursor = FAST_WEB_CHUNK_HEADER_LENGTH
    for value in plaquette_history
        cursor += 1
        output[cursor] = value
    end
    for value in polyakov_real_history
        cursor += 1
        output[cursor] = value
    end
    if nc == 2
        for index in 1:chunk_sweeps
            cursor += 1
            output[cursor] = 0.0
        end
    else
        for value in polyakov_imag_history
            cursor += 1
            output[cursor] = value
        end
    end
    for value in acceptance_history
        cursor += 1
        output[cursor] = value
    end
    for value in frames
        cursor += 1
        output[cursor] = value
    end
    for value in configuration
        cursor += 1
        output[cursor] = value
    end
    return output
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#
# Audited specialization of Gaugefields.jl portable heatbath kernel blob:
# fe6a13d0503662918fe892ec01aa2c71e8e7cfcc
const FAST_SU2_CHUNK_SCHEMA_VERSION = FAST_WEB_CHUNK_SCHEMA_VERSION

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#
const FAST_SU2_CHUNK_HEADER_LENGTH = FAST_WEB_CHUNK_HEADER_LENGTH

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

struct FastWebSu2Field{T}
    links::Vector{T}
    forward_sites::Vector{Int64}
    backward_sites::Vector{Int64}
    staple_offsets::Vector{Int64}
    plaquette_sum::Vector{Float64}
    plaquette_valid::Vector{Bool}
    polyakov_lines::Vector{Float64}
    polyakov_dirty::Vector{Bool}
    nx::Int64
    ny::Int64
    nz::Int64
    nt::Int64
    volume::Int64
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_field(nx, ny, nz, nt, low_precision=false)
    volume = Int64(nx * ny * nz * nt)
    links = low_precision ? zeros(Float32, 16 * volume) : zeros(Float64, 16 * volume)
    field = FastWebSu2Field(
        links,
        Vector{Int64}(undef, 4 * volume),
        Vector{Int64}(undef, 4 * volume),
        Vector{Int64}(undef, 72 * volume),
        zeros(Float64, 1),
        fill(false, 1),
        zeros(Float64, nx * ny * nz),
        fill(true, nx * ny * nz),
        nx,
        ny,
        nz,
        nt,
        volume,
    )
    for site in 1:volume
        x, y, z, t = _fast_su2_coordinates(field, site)
        for direction in 1:4
            forward_x, forward_y, forward_z, forward_t =
                _fast_su2_shift(field, x, y, z, t, direction, 1)
            backward_x, backward_y, backward_z, backward_t =
                _fast_su2_shift(field, x, y, z, t, direction, -1)
            neighbor_offset = 4 * (site - 1) + direction
            field.forward_sites[neighbor_offset] =
                _fast_su2_site(field, forward_x, forward_y, forward_z, forward_t)
            field.backward_sites[neighbor_offset] =
                _fast_su2_site(field, backward_x, backward_y, backward_z, backward_t)
        end
    end
    for site in 1:volume
        neighbor_offset = 4 * (site - 1)
        for mu in 1:4
            plan_cursor = 18 * (neighbor_offset + mu - 1)
            for nu in 1:4
                if nu == mu
                    continue
                end
                site_plus_mu = field.forward_sites[neighbor_offset + mu]
                site_plus_nu = field.forward_sites[neighbor_offset + nu]
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su2_offset(site_plus_mu, nu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su2_offset(site_plus_nu, mu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su2_offset(site, nu)

                site_minus_nu = field.backward_sites[neighbor_offset + nu]
                site_minus_nu_plus_mu =
                    field.forward_sites[4 * (site_minus_nu - 1) + mu]
                plan_cursor += 1
                field.staple_offsets[plan_cursor] =
                    _fast_su2_offset(site_minus_nu_plus_mu, nu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su2_offset(site_minus_nu, mu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su2_offset(site_minus_nu, nu)
            end
        end
    end
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_site(field, x, y, z, t)
    return x + field.nx * ((y - 1) + field.ny * ((z - 1) + field.nz * (t - 1)))
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_coordinates(field, site)
    remainder = site - 1
    x = mod(remainder, field.nx) + 1
    remainder = div(remainder, field.nx)
    y = mod(remainder, field.ny) + 1
    remainder = div(remainder, field.ny)
    z = mod(remainder, field.nz) + 1
    t = div(remainder, field.nz) + 1
    return x, y, z, t
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_shift(field, x, y, z, t, direction, step)
    if direction == 1
        x = mod(x - 1 + step, field.nx) + 1
    elseif direction == 2
        y = mod(y - 1 + step, field.ny) + 1
    elseif direction == 3
        z = mod(z - 1 + step, field.nz) + 1
    else
        t = mod(t - 1 + step, field.nt) + 1
    end
    return x, y, z, t
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_offset(site, direction)
    return 4 * ((site - 1) * 4 + direction - 1) + 1
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_link(field, site, direction)
    offset = _fast_su2_offset(site, direction)
    return (
        field.links[offset],
        field.links[offset + 1],
        field.links[offset + 2],
        field.links[offset + 3],
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_link(field, x, y, z, t, direction)
    return _fast_su2_link(field, _fast_su2_site(field, x, y, z, t), direction)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_set_link!(field, site, direction, value)
    offset = _fast_su2_offset(site, direction)
    field.links[offset] = value[1]
    field.links[offset + 1] = value[2]
    field.links[offset + 2] = value[3]
    field.links[offset + 3] = value[4]
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_multiply(left, right)
    a0, a1, a2, a3 = left
    b0, b1, b2, b3 = right
    return (
        a0 * b0 - a1 * b1 - a2 * b2 - a3 * b3,
        a0 * b1 + a1 * b0 - a2 * b3 + a3 * b2,
        a0 * b2 + a2 * b0 - a3 * b1 + a1 * b3,
        a0 * b3 + a3 * b0 - a1 * b2 + a2 * b1,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_adjoint(value)
    return (value[1], -value[2], -value[3], -value[4])
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_normalize(value)
    inverse_norm = inv(sqrt(value[1]^2 + value[2]^2 + value[3]^2 + value[4]^2))
    return (
        value[1] * inverse_norm,
        value[2] * inverse_norm,
        value[3] * inverse_norm,
        value[4] * inverse_norm,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_random(rng_state)
    first, second = web_standard_normal_pair!(rng_state)
    third, fourth = web_standard_normal_pair!(rng_state)
    return _fast_su2_normalize((first, second, third, fourth))
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_proposal_and_draw_state(
    state::Int64,
    epsilon::Float64,
)::Tuple{Int64,Float64,Float64,Float64,Float64,Float64}
    inverse_scale = inv(Float64(WEB_RNG_MASK))
    epsilon_squared = epsilon * epsilon
    state = xor(state, (state << 13) & WEB_RNG_MASK)
    state = xor(state, state >> 17)
    state = xor(state, (state << 5) & WEB_RNG_MASK)
    a1 = epsilon * (2.0 * ((state - 1) * inverse_scale) - 1.0)
    state = xor(state, (state << 13) & WEB_RNG_MASK)
    state = xor(state, state >> 17)
    state = xor(state, (state << 5) & WEB_RNG_MASK)
    a2 = epsilon * (2.0 * ((state - 1) * inverse_scale) - 1.0)
    state = xor(state, (state << 13) & WEB_RNG_MASK)
    state = xor(state, state >> 17)
    state = xor(state, (state << 5) & WEB_RNG_MASK)
    a3 = epsilon * (2.0 * ((state - 1) * inverse_scale) - 1.0)
    radius_squared = a1 * a1 + a2 * a2 + a3 * a3
    if radius_squared >= epsilon_squared
        return _fast_su2_proposal_and_draw_state(state, epsilon)
    end
    state = xor(state, (state << 13) & WEB_RNG_MASK)
    state = xor(state, state >> 17)
    state = xor(state, (state << 5) & WEB_RNG_MASK)
    uniform_draw = (state - 1) * inverse_scale
    return state, sqrt(max(0.0, 1.0 - radius_squared)), a1, a2, a3, uniform_draw
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_proposal_and_draw!(rng_state, epsilon)
    state, proposal0, proposal1, proposal2, proposal3, uniform_draw =
        _fast_su2_proposal_and_draw_state(rng_state[1], epsilon)
    rng_state[1] = state
    return proposal0, proposal1, proposal2, proposal3, uniform_draw
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_plaquette(field, x, y, z, t, mu, nu)
    return _fast_su2_plaquette_site(field, _fast_su2_site(field, x, y, z, t), mu, nu)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_plaquette_site(field, site, mu, nu)
    first = _fast_su2_link(field, site, mu)
    second = _fast_su2_link(field, field.forward_sites[4 * (site - 1) + mu], nu)
    third = _fast_su2_adjoint(
        _fast_su2_link(field, field.forward_sites[4 * (site - 1) + nu], mu),
    )
    fourth = _fast_su2_adjoint(_fast_su2_link(field, site, nu))
    return _fast_su2_multiply(_fast_su2_multiply(_fast_su2_multiply(first, second), third), fourth)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_affected_sum(field, x, y, z, t, mu)
    total = 0.0
    for nu in 1:4
        if nu == mu
            continue
        end
        first_direction = min(mu, nu)
        second_direction = max(mu, nu)
        total += _fast_su2_plaquette(
            field,
            x,
            y,
            z,
            t,
            first_direction,
            second_direction,
        )[1]
        shifted_x, shifted_y, shifted_z, shifted_t =
            _fast_su2_shift(field, x, y, z, t, nu, -1)
        if shifted_x != x || shifted_y != y || shifted_z != z || shifted_t != t
            total += _fast_su2_plaquette(
                field,
                shifted_x,
                shifted_y,
                shifted_z,
                shifted_t,
                first_direction,
                second_direction,
            )[1]
        end
    end
    return total
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_staple_at_plan(field, plan_cursor)
    links = field.links
    staple0 = 0.0
    staple1 = 0.0
    staple2 = 0.0
    staple3 = 0.0
    first_sign = 1.0
    for staple_index in 1:6
        first_offset = field.staple_offsets[plan_cursor + 1]
        second_offset = field.staple_offsets[plan_cursor + 2]
        third_offset = field.staple_offsets[plan_cursor + 3]
        plan_cursor += 3
        first0 = links[first_offset]
        third_sign = -first_sign
        first1 = first_sign * links[first_offset + 1]
        first2 = first_sign * links[first_offset + 2]
        first3 = first_sign * links[first_offset + 3]
        second0 = links[second_offset]
        second1 = -links[second_offset + 1]
        second2 = -links[second_offset + 2]
        second3 = -links[second_offset + 3]
        product0 = first0 * second0 - first1 * second1 -
                   first2 * second2 - first3 * second3
        product1 = first0 * second1 + first1 * second0 -
                   first2 * second3 + first3 * second2
        product2 = first0 * second2 + first2 * second0 -
                   first3 * second1 + first1 * second3
        product3 = first0 * second3 + first3 * second0 -
                   first1 * second2 + first2 * second1
        third0 = links[third_offset]
        third1 = third_sign * links[third_offset + 1]
        third2 = third_sign * links[third_offset + 2]
        third3 = third_sign * links[third_offset + 3]
        staple0 += product0 * third0 - product1 * third1 -
                   product2 * third2 - product3 * third3
        staple1 += product0 * third1 + product1 * third0 -
                   product2 * third3 + product3 * third2
        staple2 += product0 * third2 + product2 * third0 -
                   product3 * third1 + product1 * third3
        staple3 += product0 * third3 + product3 * third0 -
                   product1 * third2 + product2 * third1
        first_sign = -first_sign
    end
    return staple0, staple1, staple2, staple3
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_initialize(nx, ny, nz, nt, condition, rng_state, low_precision=false)
    field = _fast_su2_field(nx, ny, nz, nt, low_precision)
    for site in 1:field.volume
        for direction in 1:4
            value = condition == "hot" ? _fast_su2_random(rng_state) : (1.0, 0.0, 0.0, 0.0)
            _fast_su2_set_link!(field, site, direction, value)
        end
    end
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_sweep_staple!(
    field,
    beta,
    epsilon,
    rng_state,
)
    accepted = 0
    offered = 4 * field.volume
    plaquette_delta = 0.0
    links = field.links
    state = rng_state[1]
    inverse_scale = inv(Float64(WEB_RNG_MASK))
    epsilon_squared = epsilon * epsilon
    proposal_scale = 2.0 * epsilon * inverse_scale
    link_offset = 1
    staple_plan_cursor = 0
    spatial_volume = field.nx * field.ny * field.nz
    polyakov_line_index = 1
    for site in 1:field.volume
        for direction in 1:4
            proposal1 = 0.0
            proposal2 = 0.0
            proposal3 = 0.0
            radius_squared = epsilon_squared
            while radius_squared >= epsilon_squared
                state = xor(state, (state << 13) & WEB_RNG_MASK)
                state = xor(state, state >> 17)
                state = xor(state, (state << 5) & WEB_RNG_MASK)
                proposal1 = proposal_scale * (state - 1) - epsilon
                state = xor(state, (state << 13) & WEB_RNG_MASK)
                state = xor(state, state >> 17)
                state = xor(state, (state << 5) & WEB_RNG_MASK)
                proposal2 = proposal_scale * (state - 1) - epsilon
                state = xor(state, (state << 13) & WEB_RNG_MASK)
                state = xor(state, state >> 17)
                state = xor(state, (state << 5) & WEB_RNG_MASK)
                proposal3 = proposal_scale * (state - 1) - epsilon
                radius_squared = proposal1 * proposal1 +
                                 proposal2 * proposal2 +
                                 proposal3 * proposal3
            end
            proposal0 = sqrt(1.0 - radius_squared)
            state = xor(state, (state << 13) & WEB_RNG_MASK)
            state = xor(state, state >> 17)
            state = xor(state, (state << 5) & WEB_RNG_MASK)
            uniform_draw = (state - 1) * inverse_scale
            old0 = links[link_offset]
            old1 = links[link_offset + 1]
            old2 = links[link_offset + 2]
            old3 = links[link_offset + 3]
            proposed0 = proposal0 * old0 - proposal1 * old1 -
                        proposal2 * old2 - proposal3 * old3
            proposed1 = proposal0 * old1 + proposal1 * old0 -
                        proposal2 * old3 + proposal3 * old2
            proposed2 = proposal0 * old2 + proposal2 * old0 -
                        proposal3 * old1 + proposal1 * old3
            proposed3 = proposal0 * old3 + proposal3 * old0 -
                        proposal1 * old2 + proposal2 * old1
            staple0, staple1, staple2, staple3 =
                _fast_su2_staple_at_plan(field, staple_plan_cursor)
            old_scalar = old0 * staple0 - old1 * staple1 -
                         old2 * staple2 - old3 * staple3
            proposed_scalar = proposed0 * staple0 - proposed1 * staple1 -
                              proposed2 * staple2 - proposed3 * staple3
            delta_action = -beta * (proposed_scalar - old_scalar)
            if delta_action <= 0.0 || uniform_draw < exp(-delta_action)
                links[link_offset] = proposed0
                links[link_offset + 1] = proposed1
                links[link_offset + 2] = proposed2
                links[link_offset + 3] = proposed3
                accepted += 1
                plaquette_delta += proposed_scalar - old_scalar
                if direction == 4
                    field.polyakov_dirty[polyakov_line_index] = true
                end
            end
            link_offset += 4
            staple_plan_cursor += 18
        end
        polyakov_line_index += 1
        if polyakov_line_index > spatial_volume
            polyakov_line_index = 1
        end
    end
    rng_state[1] = state
    if field.plaquette_valid[1]
        field.plaquette_sum[1] += plaquette_delta
    end
    return accepted, offered, plaquette_delta
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_heatbath_sweep!(field, beta, rng_state)
    accepted = 4 * field.volume
    offered = accepted
    plaquette_delta = 0.0
    links = field.links
    state = rng_state[1]
    inverse_scale = inv(Float64(WEB_RNG_MASK))
    link_offset = 1
    staple_plan_cursor = 0
    spatial_volume = field.nx * field.ny * field.nz
    polyakov_line_index = 1
    for site in 1:field.volume
        for direction in 1:4
            old0 = links[link_offset]
            old1 = links[link_offset + 1]
            old2 = links[link_offset + 2]
            old3 = links[link_offset + 3]
            staple0, staple1, staple2, staple3 =
                _fast_su2_staple_at_plan(field, staple_plan_cursor)
            rho = sqrt(
                staple0 * staple0 + staple1 * staple1 +
                staple2 * staple2 + staple3 * staple3,
            )
            state, sample0, sample1, sample2, sample3 =
                _fast_web_kennedy_pendleton_state(state, beta * rho, inverse_scale)
            if rho > 1.0e-14
                inverse_rho = inv(rho)
                v0 = staple0 * inverse_rho
                v1 = -staple1 * inverse_rho
                v2 = -staple2 * inverse_rho
                v3 = -staple3 * inverse_rho
                proposed0 = sample0 * v0 - sample1 * v1 - sample2 * v2 - sample3 * v3
                proposed1 = sample0 * v1 + sample1 * v0 - sample2 * v3 + sample3 * v2
                proposed2 = sample0 * v2 + sample2 * v0 - sample3 * v1 + sample1 * v3
                proposed3 = sample0 * v3 + sample3 * v0 - sample1 * v2 + sample2 * v1
            else
                proposed0 = sample0
                proposed1 = sample1
                proposed2 = sample2
                proposed3 = sample3
            end
            old_scalar = old0 * staple0 - old1 * staple1 -
                         old2 * staple2 - old3 * staple3
            proposed_scalar = proposed0 * staple0 - proposed1 * staple1 -
                              proposed2 * staple2 - proposed3 * staple3
            links[link_offset] = proposed0
            links[link_offset + 1] = proposed1
            links[link_offset + 2] = proposed2
            links[link_offset + 3] = proposed3
            plaquette_delta += proposed_scalar - old_scalar
            if direction == 4
                field.polyakov_dirty[polyakov_line_index] = true
            end
            link_offset += 4
            staple_plan_cursor += 18
        end
        polyakov_line_index += 1
        if polyakov_line_index > spatial_volume
            polyakov_line_index = 1
        end
    end
    rng_state[1] = state
    if field.plaquette_valid[1]
        field.plaquette_sum[1] += plaquette_delta
    end
    return accepted, offered, plaquette_delta
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_sweep_degenerate!(field, beta, epsilon, rng_state)
    accepted = 0
    offered = 0
    plaquette_delta = 0.0
    for site in 1:field.volume
        x, y, z, t = _fast_su2_coordinates(field, site)
        for direction in 1:4
            offered += 1
            old_link = _fast_su2_link(field, site, direction)
            proposal0, proposal1, proposal2, proposal3, uniform_draw =
                _fast_su2_proposal_and_draw!(rng_state, epsilon)
            proposed_link = _fast_su2_multiply(
                (proposal0, proposal1, proposal2, proposal3),
                old_link,
            )
            old_sum = _fast_su2_affected_sum(field, x, y, z, t, direction)
            _fast_su2_set_link!(field, site, direction, proposed_link)
            new_sum = _fast_su2_affected_sum(field, x, y, z, t, direction)
            _fast_su2_set_link!(field, site, direction, old_link)
            delta_action = -beta * (new_sum - old_sum)
            if delta_action <= 0.0 || uniform_draw < exp(-delta_action)
                _fast_su2_set_link!(field, site, direction, proposed_link)
                accepted += 1
                plaquette_delta += new_sum - old_sum
                if direction == 4
                    line_index = mod(site - 1, field.nx * field.ny * field.nz) + 1
                    field.polyakov_dirty[line_index] = true
                end
            end
        end
    end
    field.plaquette_valid[1] = false
    return accepted, offered, plaquette_delta
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_sweep!(field, beta, epsilon, rng_state)
    if field.nx > 1 && field.ny > 1 && field.nz > 1 && field.nt > 1
        return _fast_su2_sweep_staple!(field, beta, epsilon, rng_state)
    end
    return _fast_su2_sweep_degenerate!(field, beta, epsilon, rng_state)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_normalized_plaquette(field)
    if !field.plaquette_valid[1]
        total = 0.0
        for site in 1:field.volume
            for mu in 1:3
                for nu in (mu + 1):4
                    total += _fast_su2_plaquette_site(field, site, mu, nu)[1]
                end
            end
        end
        field.plaquette_sum[1] = total
        field.plaquette_valid[1] = true
    end
    return field.plaquette_sum[1] / (6.0 * field.volume)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_polyakov(field)
    total = 0.0
    for z in 1:field.nz
        for y in 1:field.ny
            for x in 1:field.nx
                line_index = x + field.nx * ((y - 1) + field.ny * (z - 1))
                if field.polyakov_dirty[line_index]
                    product = (1.0, 0.0, 0.0, 0.0)
                    for t in 1:field.nt
                        product = _fast_su2_multiply(
                            product,
                            _fast_su2_link(field, x, y, z, t, 4),
                        )
                    end
                    field.polyakov_lines[line_index] = product[1]
                    field.polyakov_dirty[line_index] = false
                end
                total += field.polyakov_lines[line_index]
            end
        end
    end
    return total / (field.nx * field.ny * field.nz)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_local_energy(field, x, y, z, t)
    total = 0.0
    for mu in 1:3
        for nu in (mu + 1):4
            total += 1.0 - _fast_su2_plaquette(field, x, y, z, t, mu, nu)[1]
        end
    end
    return total
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_plane_axes(plane)
    if plane == "xy"
        return 1, 2, 3, 4
    elseif plane == "xz"
        return 1, 3, 2, 4
    elseif plane == "xt"
        return 1, 4, 2, 3
    elseif plane == "yz"
        return 2, 3, 1, 4
    elseif plane == "yt"
        return 2, 4, 1, 3
    end
    return 3, 4, 1, 2
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_slice_plan(field, plane, slice)
    first_axis, second_axis, first_fixed_axis, second_fixed_axis = _fast_su2_plane_axes(plane)
    extents = (field.nx, field.ny, field.nz, field.nt)
    width = extents[first_axis]
    height = extents[second_axis]
    first_fixed = slice isa Tuple ? slice[1] : slice
    second_fixed = slice isa Tuple ? slice[2] : slice
    sites = Vector{Int64}(undef, width * height)
    for second_coordinate in 1:height
        for first_coordinate in 1:width
            x = first_axis == 1 ? first_coordinate :
                second_axis == 1 ? second_coordinate :
                first_fixed_axis == 1 ? first_fixed : second_fixed
            y = first_axis == 2 ? first_coordinate :
                second_axis == 2 ? second_coordinate :
                first_fixed_axis == 2 ? first_fixed : second_fixed
            z = first_axis == 3 ? first_coordinate :
                second_axis == 3 ? second_coordinate :
                first_fixed_axis == 3 ? first_fixed : second_fixed
            t = first_axis == 4 ? first_coordinate :
                second_axis == 4 ? second_coordinate :
                first_fixed_axis == 4 ? first_fixed : second_fixed
            sites[(second_coordinate - 1) * width + first_coordinate] =
                _fast_su2_site(field, x, y, z, t)
        end
    end
    return width, height, sites
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_slice_from_plan!(output, field, sites)
    for index in 1:length(sites)
        site = sites[index]
        x, y, z, t = _fast_su2_coordinates(field, site)
        output[index] = _fast_su2_local_energy(field, x, y, z, t)
    end
    return output
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_configuration_length(field)
    return 16 * field.volume
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_encode_configuration(field)
    output = Vector{Float64}(undef, _fast_su2_configuration_length(field))
    for index in 1:length(field.links)
        output[index] = Float64(field.links[index])
    end
    return output
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_decode_configuration(nx, ny, nz, nt, configuration, low_precision=false)
    field = _fast_su2_field(nx, ny, nz, nt, low_precision)
    compact_length = _fast_su2_configuration_length(field)
    matrix_length = 2 * compact_length
    if length(configuration) != compact_length && length(configuration) != matrix_length
        throw(DimensionMismatch("invalid SU(2) configuration length"))
    end
    if length(configuration) == compact_length
        for index in 1:compact_length
            value = Float64(configuration[index])
            if !isfinite(value)
                throw(ArgumentError("configuration state must be finite"))
            end
            field.links[index] = value
        end
    else
        cursor = 0
        for direction in 1:4
            for site in 1:field.volume
                value = (
                    Float64(configuration[cursor + 1]),
                    Float64(configuration[cursor + 6]),
                    Float64(configuration[cursor + 5]),
                    Float64(configuration[cursor + 2]),
                )
                if !isfinite(value[1]) || !isfinite(value[2]) ||
                   !isfinite(value[3]) || !isfinite(value[4])
                    throw(ArgumentError("configuration state must be finite"))
                end
                _fast_su2_set_link!(field, site, direction, value)
                cursor += 8
            end
        end
    end
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

struct FastWebSu2Session{T}
    field::FastWebSu2Field{T}
    rng_state::Vector{Int64}
    beta::Float64
    epsilon::Float64
    algorithm::String
    completed_sweeps::Vector{Int64}
    width::Int64
    height::Int64
    slice_sites::Vector{Int64}
    slice_buffer::Vector{Float64}
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su2_session(
    nx,
    ny,
    nz,
    nt,
    beta,
    seed_or_rng_state,
    completed_sweeps,
    configuration;
    epsilon=0.2,
    condition="cold",
    plane="xy",
    slice=1,
    low_precision=false,
    algorithm="metropolis",
)
    if completed_sweeps < 0
        throw(ArgumentError("completed_sweeps must be nonnegative"))
    end
    algorithm_name = _fast_web_validate_algorithm(algorithm, nx, ny, nz, nt)
    rng_state = isempty(configuration) ? web_rng_state(seed_or_rng_state) :
                restore_web_rng_state(seed_or_rng_state)
    field = isempty(configuration) ?
            _fast_su2_initialize(nx, ny, nz, nt, condition, rng_state, low_precision) :
            _fast_su2_decode_configuration(nx, ny, nz, nt, configuration, low_precision)
    width, height, slice_sites = _fast_su2_slice_plan(field, plane, slice)
    frame_size = width * height
    slice_buffer = zeros(Float64, frame_size)
    _fast_su2_normalized_plaquette(field)
    _fast_su2_polyakov(field)
    return FastWebSu2Session(
        field,
        rng_state,
        Float64(beta),
        Float64(epsilon),
        algorithm_name,
        Int64[completed_sweeps],
        Int64(width),
        Int64(height),
        slice_sites,
        slice_buffer,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _run_fast_su2_session_chunk!(session, chunk_sweeps, include_configuration)
    _fast_web_validate_chunk_sweeps(chunk_sweeps)
    field = session.field
    width = session.width
    height = session.height
    frame_size = width * height
    frames = Vector{Float64}(undef, (chunk_sweeps + 1) * frame_size)
    slice_buffer = session.slice_buffer
    _fast_su2_slice_from_plan!(slice_buffer, field, session.slice_sites)
    _fast_web_copy_frame!(frames, 0, frame_size, slice_buffer)

    plaquette_history = Vector{Float64}(undef, chunk_sweeps)
    polyakov_history = Vector{Float64}(undef, chunk_sweeps)
    acceptance_history = Vector{Float64}(undef, chunk_sweeps)
    total_accepted = 0
    total_offered = 0
    for sweep_index in 1:chunk_sweeps
        accepted, offered, _ = if session.algorithm == "heatbath"
            _fast_su2_heatbath_sweep!(field, session.beta, session.rng_state)
        else
            _fast_su2_sweep!(field, session.beta, session.epsilon, session.rng_state)
        end
        total_accepted += accepted
        total_offered += offered
        plaquette_history[sweep_index] = _fast_su2_normalized_plaquette(field)
        polyakov_history[sweep_index] = _fast_su2_polyakov(field)
        acceptance_history[sweep_index] = accepted / offered
        _fast_su2_slice_from_plan!(slice_buffer, field, session.slice_sites)
        frame_offset = sweep_index * frame_size
        _fast_web_copy_frame!(frames, frame_offset, frame_size, slice_buffer)
    end

    final_plaquette =
        chunk_sweeps == 0 ? _fast_su2_normalized_plaquette(field) :
        plaquette_history[chunk_sweeps]
    final_polyakov =
        chunk_sweeps == 0 ? _fast_su2_polyakov(field) : polyakov_history[chunk_sweeps]
    session.completed_sweeps[1] += chunk_sweeps
    encoded_configuration =
        include_configuration ? _fast_su2_encode_configuration(field) : Float64[]
    return _fast_web_encode_session_chunk(
        2,
        field.nx,
        field.ny,
        field.nz,
        field.nt,
        chunk_sweeps,
        include_configuration,
        session.completed_sweeps[1],
        final_plaquette,
        final_polyakov,
        0.0,
        total_accepted,
        total_offered,
        width,
        height,
        session.rng_state[1],
        plaquette_history,
        polyakov_history,
        Float64[],
        acceptance_history,
        frames,
        encoded_configuration,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function run_fast_su2_chunk_web(
    nx,
    ny,
    nz,
    nt,
    beta,
    chunk_sweeps,
    seed_or_rng_state,
    completed_sweeps,
    configuration;
    epsilon=0.2,
    condition="cold",
    plane="xy",
    slice=1,
    low_precision=false,
    algorithm="metropolis",
)
    session = _fast_su2_session(
        nx,
        ny,
        nz,
        nt,
        beta,
        seed_or_rng_state,
        completed_sweeps,
        configuration;
        epsilon=epsilon,
        condition=condition,
        plane=plane,
        slice=slice,
        low_precision=low_precision,
        algorithm=algorithm,
    )
    return _run_fast_su2_session_chunk!(session, chunk_sweeps, true)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function start_fast_su2_web_session(
    nx,
    ny,
    nz,
    nt,
    beta,
    seed;
    epsilon=0.2,
    condition="cold",
    plane="xy",
    slice=1,
    low_precision=false,
    algorithm="metropolis",
)
    return _fast_su2_session(
        nx,
        ny,
        nz,
        nt,
        beta,
        seed,
        0,
        Float64[];
        epsilon=epsilon,
        condition=condition,
        plane=plane,
        slice=slice,
        low_precision=low_precision,
        algorithm=algorithm,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function run_fast_web_session_chunk!(session, chunk_sweeps)
    return _run_fast_su2_session_chunk!(session, chunk_sweeps, false)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function reconfigure_fast_su2_web_session(session, plane, slice)
    width, height, slice_sites = _fast_su2_slice_plan(session.field, plane, slice)
    return FastWebSu2Session(
        session.field,
        session.rng_state,
        session.beta,
        session.epsilon,
        session.algorithm,
        session.completed_sweeps,
        Int64(width),
        Int64(height),
        slice_sites,
        zeros(Float64, width * height),
    )
end
