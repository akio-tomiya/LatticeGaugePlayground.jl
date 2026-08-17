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
const FAST_SU3_CHUNK_SCHEMA_VERSION = FAST_WEB_CHUNK_SCHEMA_VERSION

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#
const FAST_SU3_CHUNK_HEADER_LENGTH = FAST_WEB_CHUNK_HEADER_LENGTH

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

struct FastWebSu3Field
    links::Vector{Float64}
    forward_sites::Vector{Int64}
    backward_sites::Vector{Int64}
    staple_offsets::Vector{Int64}
    plaquette_sum::Vector{Float64}
    plaquette_valid::Vector{Bool}
    polyakov_lines_real::Vector{Float64}
    polyakov_lines_imag::Vector{Float64}
    polyakov_dirty::Vector{Bool}
    nx::Int64
    ny::Int64
    nz::Int64
    nt::Int64
    volume::Int64
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_site(field, x, y, z, t)
    return x + field.nx * ((y - 1) + field.ny * ((z - 1) + field.nz * (t - 1)))
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_coordinates(field, site)
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

function _fast_su3_shift(field, x, y, z, t, direction, step)
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

function _fast_su3_offset(site, direction)
    return 18 * ((site - 1) * 4 + direction - 1) + 1
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_field(nx, ny, nz, nt)
    volume = Int64(nx * ny * nz * nt)
    field = FastWebSu3Field(
        zeros(Float64, 72 * volume),
        Vector{Int64}(undef, 4 * volume),
        Vector{Int64}(undef, 4 * volume),
        Vector{Int64}(undef, 72 * volume),
        zeros(Float64, 1),
        fill(false, 1),
        zeros(Float64, nx * ny * nz),
        zeros(Float64, nx * ny * nz),
        fill(true, nx * ny * nz),
        nx,
        ny,
        nz,
        nt,
        volume,
    )
    for site in 1:volume
        x, y, z, t = _fast_su3_coordinates(field, site)
        for direction in 1:4
            forward_x, forward_y, forward_z, forward_t =
                _fast_su3_shift(field, x, y, z, t, direction, 1)
            backward_x, backward_y, backward_z, backward_t =
                _fast_su3_shift(field, x, y, z, t, direction, -1)
            neighbor_offset = 4 * (site - 1) + direction
            field.forward_sites[neighbor_offset] =
                _fast_su3_site(field, forward_x, forward_y, forward_z, forward_t)
            field.backward_sites[neighbor_offset] =
                _fast_su3_site(field, backward_x, backward_y, backward_z, backward_t)
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
                field.staple_offsets[plan_cursor] = _fast_su3_offset(site_plus_mu, nu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su3_offset(site_plus_nu, mu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su3_offset(site, nu)

                site_minus_nu = field.backward_sites[neighbor_offset + nu]
                site_minus_nu_plus_mu =
                    field.forward_sites[4 * (site_minus_nu - 1) + mu]
                plan_cursor += 1
                field.staple_offsets[plan_cursor] =
                    _fast_su3_offset(site_minus_nu_plus_mu, nu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su3_offset(site_minus_nu, mu)
                plan_cursor += 1
                field.staple_offsets[plan_cursor] = _fast_su3_offset(site_minus_nu, nu)
            end
        end
    end
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_link_at_offset(field, offset)
    links = field.links
    return (
        links[offset], links[offset + 1], links[offset + 2],
        links[offset + 3], links[offset + 4], links[offset + 5],
        links[offset + 6], links[offset + 7], links[offset + 8],
        links[offset + 9], links[offset + 10], links[offset + 11],
        links[offset + 12], links[offset + 13], links[offset + 14],
        links[offset + 15], links[offset + 16], links[offset + 17],
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_link(field, site, direction)
    return _fast_su3_link_at_offset(field, _fast_su3_offset(site, direction))
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_set_link!(field, site, direction, value)
    offset = _fast_su3_offset(site, direction)
    for index in 1:18
        field.links[offset + index - 1] = value[index]
    end
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_multiply(left, right)
    l1, l2, l3, l4, l5, l6 = left[1], left[2], left[3], left[4], left[5], left[6]
    l7, l8, l9, l10, l11, l12 = left[7], left[8], left[9], left[10], left[11], left[12]
    l13, l14, l15, l16, l17, l18 =
        left[13], left[14], left[15], left[16], left[17], left[18]
    r1, r2, r3, r4, r5, r6 = right[1], right[2], right[3], right[4], right[5], right[6]
    r7, r8, r9, r10, r11, r12 =
        right[7], right[8], right[9], right[10], right[11], right[12]
    r13, r14, r15, r16, r17, r18 =
        right[13], right[14], right[15], right[16], right[17], right[18]
    return (
        l1 * r1 - l2 * r2 + l3 * r7 - l4 * r8 + l5 * r13 - l6 * r14,
        l1 * r2 + l2 * r1 + l3 * r8 + l4 * r7 + l5 * r14 + l6 * r13,
        l1 * r3 - l2 * r4 + l3 * r9 - l4 * r10 + l5 * r15 - l6 * r16,
        l1 * r4 + l2 * r3 + l3 * r10 + l4 * r9 + l5 * r16 + l6 * r15,
        l1 * r5 - l2 * r6 + l3 * r11 - l4 * r12 + l5 * r17 - l6 * r18,
        l1 * r6 + l2 * r5 + l3 * r12 + l4 * r11 + l5 * r18 + l6 * r17,
        l7 * r1 - l8 * r2 + l9 * r7 - l10 * r8 + l11 * r13 - l12 * r14,
        l7 * r2 + l8 * r1 + l9 * r8 + l10 * r7 + l11 * r14 + l12 * r13,
        l7 * r3 - l8 * r4 + l9 * r9 - l10 * r10 + l11 * r15 - l12 * r16,
        l7 * r4 + l8 * r3 + l9 * r10 + l10 * r9 + l11 * r16 + l12 * r15,
        l7 * r5 - l8 * r6 + l9 * r11 - l10 * r12 + l11 * r17 - l12 * r18,
        l7 * r6 + l8 * r5 + l9 * r12 + l10 * r11 + l11 * r18 + l12 * r17,
        l13 * r1 - l14 * r2 + l15 * r7 - l16 * r8 + l17 * r13 - l18 * r14,
        l13 * r2 + l14 * r1 + l15 * r8 + l16 * r7 + l17 * r14 + l18 * r13,
        l13 * r3 - l14 * r4 + l15 * r9 - l16 * r10 + l17 * r15 - l18 * r16,
        l13 * r4 + l14 * r3 + l15 * r10 + l16 * r9 + l17 * r16 + l18 * r15,
        l13 * r5 - l14 * r6 + l15 * r11 - l16 * r12 + l17 * r17 - l18 * r18,
        l13 * r6 + l14 * r5 + l15 * r12 + l16 * r11 + l17 * r18 + l18 * r17,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_adjoint(value)
    return (
        value[1], -value[2], value[7], -value[8], value[13], -value[14],
        value[3], -value[4], value[9], -value[10], value[15], -value[16],
        value[5], -value[6], value[11], -value[12], value[17], -value[18],
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_trace(value)
    return value[1] + value[9] + value[17], value[2] + value[10] + value[18]
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_trace_product(left, right)
    return left[1] * right[1] - left[2] * right[2] +
           left[3] * right[7] - left[4] * right[8] +
           left[5] * right[13] - left[6] * right[14] +
           left[7] * right[3] - left[8] * right[4] +
           left[9] * right[9] - left[10] * right[10] +
           left[11] * right[15] - left[12] * right[16] +
           left[13] * right[5] - left[14] * right[6] +
           left[15] * right[11] - left[16] * right[12] +
           left[17] * right[17] - left[18] * right[18]
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_identity()
    return (
        1.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 0.0, 1.0, 0.0,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_random(rng_state)
    values = Vector{ComplexF64}(undef, 9)
    for column in 1:3
        for row in 1:3
            real_part, imaginary_part = web_standard_normal_pair!(rng_state)
            values[3 * (row - 1) + column] = ComplexF64(real_part, imaginary_part)
        end
    end
    for column in 1:3
        for previous in 1:(column - 1)
            projection = 0.0 + 0.0im
            for row in 1:3
                projection += conj(values[3 * (row - 1) + previous]) *
                              values[3 * (row - 1) + column]
            end
            for row in 1:3
                index = 3 * (row - 1) + column
                values[index] -= projection * values[3 * (row - 1) + previous]
            end
        end
        norm_squared = 0.0
        for row in 1:3
            norm_squared += abs2(values[3 * (row - 1) + column])
        end
        inverse_norm = inv(sqrt(norm_squared))
        for row in 1:3
            index = 3 * (row - 1) + column
            values[index] *= inverse_norm
        end
    end
    determinant =
        values[1] * (values[5] * values[9] - values[6] * values[8]) -
        values[2] * (values[4] * values[9] - values[6] * values[7]) +
        values[3] * (values[4] * values[8] - values[5] * values[7])
    phase_correction = conj(determinant) / abs(determinant)
    values[1] *= phase_correction
    values[4] *= phase_correction
    values[7] *= phase_correction
    return (
        real(values[1]), imag(values[1]), real(values[2]), imag(values[2]),
        real(values[3]), imag(values[3]), real(values[4]), imag(values[4]),
        real(values[5]), imag(values[5]), real(values[6]), imag(values[6]),
        real(values[7]), imag(values[7]), real(values[8]), imag(values[8]),
        real(values[9]), imag(values[9]),
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_initialize(nx, ny, nz, nt, condition, rng_state)
    field = _fast_su3_field(nx, ny, nz, nt)
    # Keep the public Web API's direction-major RNG order so hot starts remain
    # bit-for-bit reproducible across the generic and optimized kernels.
    for direction in 1:4
        for site in 1:field.volume
            value = condition == "hot" ? _fast_su3_random(rng_state) : _fast_su3_identity()
            _fast_su3_set_link!(field, site, direction, value)
        end
    end
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_proposal_and_draw_state(
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
        return _fast_su3_proposal_and_draw_state(state, epsilon)
    end
    state = xor(state, (state << 13) & WEB_RNG_MASK)
    state = xor(state, state >> 17)
    state = xor(state, (state << 5) & WEB_RNG_MASK)
    uniform_draw = (state - 1) * inverse_scale
    return state, sqrt(max(0.0, 1.0 - radius_squared)), a1, a2, a3, uniform_draw
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_proposed_link(old, pair, a0, a1, a2, a3)
    o1, o2, o3, o4, o5, o6 = old[1], old[2], old[3], old[4], old[5], old[6]
    o7, o8, o9, o10, o11, o12 = old[7], old[8], old[9], old[10], old[11], old[12]
    o13, o14, o15, o16, o17, o18 =
        old[13], old[14], old[15], old[16], old[17], old[18]
    q11r, q11i = a0, a3
    q12r, q12i = a2, a1
    q21r, q21i = -a2, a1
    q22r, q22i = a0, -a3
    if pair == 1
        return (
            q11r * o1 - q11i * o2 + q12r * o7 - q12i * o8,
            q11r * o2 + q11i * o1 + q12r * o8 + q12i * o7,
            q11r * o3 - q11i * o4 + q12r * o9 - q12i * o10,
            q11r * o4 + q11i * o3 + q12r * o10 + q12i * o9,
            q11r * o5 - q11i * o6 + q12r * o11 - q12i * o12,
            q11r * o6 + q11i * o5 + q12r * o12 + q12i * o11,
            q21r * o1 - q21i * o2 + q22r * o7 - q22i * o8,
            q21r * o2 + q21i * o1 + q22r * o8 + q22i * o7,
            q21r * o3 - q21i * o4 + q22r * o9 - q22i * o10,
            q21r * o4 + q21i * o3 + q22r * o10 + q22i * o9,
            q21r * o5 - q21i * o6 + q22r * o11 - q22i * o12,
            q21r * o6 + q21i * o5 + q22r * o12 + q22i * o11,
            o13, o14, o15, o16, o17, o18,
        )
    elseif pair == 2
        return (
            o1, o2, o3, o4, o5, o6,
            q11r * o7 - q11i * o8 + q12r * o13 - q12i * o14,
            q11r * o8 + q11i * o7 + q12r * o14 + q12i * o13,
            q11r * o9 - q11i * o10 + q12r * o15 - q12i * o16,
            q11r * o10 + q11i * o9 + q12r * o16 + q12i * o15,
            q11r * o11 - q11i * o12 + q12r * o17 - q12i * o18,
            q11r * o12 + q11i * o11 + q12r * o18 + q12i * o17,
            q21r * o7 - q21i * o8 + q22r * o13 - q22i * o14,
            q21r * o8 + q21i * o7 + q22r * o14 + q22i * o13,
            q21r * o9 - q21i * o10 + q22r * o15 - q22i * o16,
            q21r * o10 + q21i * o9 + q22r * o16 + q22i * o15,
            q21r * o11 - q21i * o12 + q22r * o17 - q22i * o18,
            q21r * o12 + q21i * o11 + q22r * o18 + q22i * o17,
        )
    end
    return (
        q11r * o1 - q11i * o2 + q12r * o13 - q12i * o14,
        q11r * o2 + q11i * o1 + q12r * o14 + q12i * o13,
        q11r * o3 - q11i * o4 + q12r * o15 - q12i * o16,
        q11r * o4 + q11i * o3 + q12r * o16 + q12i * o15,
        q11r * o5 - q11i * o6 + q12r * o17 - q12i * o18,
        q11r * o6 + q11i * o5 + q12r * o18 + q12i * o17,
        o7, o8, o9, o10, o11, o12,
        q21r * o1 - q21i * o2 + q22r * o13 - q22i * o14,
        q21r * o2 + q21i * o1 + q22r * o14 + q22i * o13,
        q21r * o3 - q21i * o4 + q22r * o15 - q22i * o16,
        q21r * o4 + q21i * o3 + q22r * o16 + q22i * o15,
        q21r * o5 - q21i * o6 + q22r * o17 - q22i * o18,
        q21r * o6 + q21i * o5 + q22r * o18 + q22i * o17,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_staple_site(field, site, mu)
    links = field.links
    staple_offsets = field.staple_offsets
    staple = (
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    )
    plan_cursor = 18 * (4 * (site - 1) + mu - 1)
    for staple_index in 1:6
        first_offset = staple_offsets[plan_cursor + 1]
        second_offset = staple_offsets[plan_cursor + 2]
        third_offset = staple_offsets[plan_cursor + 3]
        first = (
            links[first_offset], links[first_offset + 1], links[first_offset + 2],
            links[first_offset + 3], links[first_offset + 4], links[first_offset + 5],
            links[first_offset + 6], links[first_offset + 7], links[first_offset + 8],
            links[first_offset + 9], links[first_offset + 10], links[first_offset + 11],
            links[first_offset + 12], links[first_offset + 13], links[first_offset + 14],
            links[first_offset + 15], links[first_offset + 16], links[first_offset + 17],
        )
        second = (
            links[second_offset], links[second_offset + 1], links[second_offset + 2],
            links[second_offset + 3], links[second_offset + 4], links[second_offset + 5],
            links[second_offset + 6], links[second_offset + 7], links[second_offset + 8],
            links[second_offset + 9], links[second_offset + 10], links[second_offset + 11],
            links[second_offset + 12], links[second_offset + 13], links[second_offset + 14],
            links[second_offset + 15], links[second_offset + 16], links[second_offset + 17],
        )
        third = (
            links[third_offset], links[third_offset + 1], links[third_offset + 2],
            links[third_offset + 3], links[third_offset + 4], links[third_offset + 5],
            links[third_offset + 6], links[third_offset + 7], links[third_offset + 8],
            links[third_offset + 9], links[third_offset + 10], links[third_offset + 11],
            links[third_offset + 12], links[third_offset + 13], links[third_offset + 14],
            links[third_offset + 15], links[third_offset + 16], links[third_offset + 17],
        )
        plan_cursor += 3
        product = if isodd(staple_index)
            _fast_su3_multiply(_fast_su3_multiply(first, _fast_su3_adjoint(second)),
                               _fast_su3_adjoint(third))
        else
            _fast_su3_multiply(_fast_su3_multiply(_fast_su3_adjoint(first),
                                                  _fast_su3_adjoint(second)), third)
        end
        staple = (
            staple[1] + product[1], staple[2] + product[2], staple[3] + product[3],
            staple[4] + product[4], staple[5] + product[5], staple[6] + product[6],
            staple[7] + product[7], staple[8] + product[8], staple[9] + product[9],
            staple[10] + product[10], staple[11] + product[11], staple[12] + product[12],
            staple[13] + product[13], staple[14] + product[14], staple[15] + product[15],
            staple[16] + product[16], staple[17] + product[17], staple[18] + product[18],
        )
    end
    return staple
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_plaquette_site(field, site, mu, nu)
    first = _fast_su3_link(field, site, mu)
    second = _fast_su3_link(field, field.forward_sites[4 * (site - 1) + mu], nu)
    third = _fast_su3_adjoint(
        _fast_su3_link(field, field.forward_sites[4 * (site - 1) + nu], mu),
    )
    fourth = _fast_su3_adjoint(_fast_su3_link(field, site, nu))
    return _fast_su3_multiply(_fast_su3_multiply(_fast_su3_multiply(first, second), third),
                              fourth)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_affected_sum(field, site, mu)
    total = 0.0
    for nu in 1:4
        if nu == mu
            continue
        end
        first_direction = min(mu, nu)
        second_direction = max(mu, nu)
        total += _fast_su3_trace(
            _fast_su3_plaquette_site(field, site, first_direction, second_direction),
        )[1]
        shifted_site = field.backward_sites[4 * (site - 1) + nu]
        if shifted_site != site
            total += _fast_su3_trace(
                _fast_su3_plaquette_site(
                    field,
                    shifted_site,
                    first_direction,
                    second_direction,
                ),
            )[1]
        end
    end
    return total
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_sweep_staple!(field, beta, epsilon, rng_state)
    accepted = 0
    offered = 0
    plaquette_delta = 0.0
    state = rng_state[1]
    for site in 1:field.volume
        for direction in 1:4
            offered += 1
            pair = mod(offered - 1, 3) + 1
            state, a0, a1, a2, a3, uniform_draw =
                _fast_su3_proposal_and_draw_state(state, epsilon)
            old = _fast_su3_link(field, site, direction)
            proposed = _fast_su3_proposed_link(old, pair, a0, a1, a2, a3)
            staple = _fast_su3_staple_site(field, site, direction)
            old_scalar = _fast_su3_trace_product(old, staple)
            proposed_scalar = _fast_su3_trace_product(proposed, staple)
            delta = proposed_scalar - old_scalar
            delta_action = -(beta / 3.0) * delta
            if delta_action <= 0.0 || uniform_draw < exp(-delta_action)
                _fast_su3_set_link!(field, site, direction, proposed)
                accepted += 1
                plaquette_delta += delta
                if direction == 4
                    line_index = mod(site - 1, field.nx * field.ny * field.nz) + 1
                    field.polyakov_dirty[line_index] = true
                end
            end
        end
    end
    rng_state[1] = state
    if field.plaquette_valid[1]
        field.plaquette_sum[1] += plaquette_delta
    end
    return accepted, offered, plaquette_delta
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_reunitarize(value)
    c11r, c11i = value[1], value[2]
    c21r, c21i = value[7], value[8]
    c31r, c31i = value[13], value[14]
    inverse_first_norm = inv(sqrt(
        c11r * c11r + c11i * c11i +
        c21r * c21r + c21i * c21i +
        c31r * c31r + c31i * c31i,
    ))
    c11r *= inverse_first_norm
    c11i *= inverse_first_norm
    c21r *= inverse_first_norm
    c21i *= inverse_first_norm
    c31r *= inverse_first_norm
    c31i *= inverse_first_norm

    c12r, c12i = value[3], value[4]
    c22r, c22i = value[9], value[10]
    c32r, c32i = value[15], value[16]
    projection_real = c11r * c12r + c11i * c12i +
                      c21r * c22r + c21i * c22i +
                      c31r * c32r + c31i * c32i
    projection_imag = c11r * c12i - c11i * c12r +
                      c21r * c22i - c21i * c22r +
                      c31r * c32i - c31i * c32r
    c12r -= c11r * projection_real - c11i * projection_imag
    c12i -= c11r * projection_imag + c11i * projection_real
    c22r -= c21r * projection_real - c21i * projection_imag
    c22i -= c21r * projection_imag + c21i * projection_real
    c32r -= c31r * projection_real - c31i * projection_imag
    c32i -= c31r * projection_imag + c31i * projection_real
    inverse_second_norm = inv(sqrt(
        c12r * c12r + c12i * c12i +
        c22r * c22r + c22i * c22i +
        c32r * c32r + c32i * c32i,
    ))
    c12r *= inverse_second_norm
    c12i *= inverse_second_norm
    c22r *= inverse_second_norm
    c22i *= inverse_second_norm
    c32r *= inverse_second_norm
    c32i *= inverse_second_norm

    c13r = c21r * c32r - c21i * c32i - c31r * c22r + c31i * c22i
    c13i = -(c21r * c32i + c21i * c32r - c31r * c22i - c31i * c22r)
    c23r = c31r * c12r - c31i * c12i - c11r * c32r + c11i * c32i
    c23i = -(c31r * c12i + c31i * c12r - c11r * c32i - c11i * c32r)
    c33r = c11r * c22r - c11i * c22i - c21r * c12r + c21i * c12i
    c33i = -(c11r * c22i + c11i * c22r - c21r * c12i - c21i * c12r)
    return (
        c11r, c11i, c12r, c12i, c13r, c13i,
        c21r, c21i, c22r, c22i, c23r, c23i,
        c31r, c31i, c32r, c32i, c33r, c33i,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_heatbath_subgroup_state(state, uv, pair, beta, inverse_scale)
    if pair == 1
        s11r, s11i = uv[1], uv[2]
        s12r, s12i = uv[3], uv[4]
        s21r, s21i = uv[7], uv[8]
        s22r, s22i = uv[9], uv[10]
    elseif pair == 2
        s11r, s11i = uv[9], uv[10]
        s12r, s12i = uv[11], uv[12]
        s21r, s21i = uv[15], uv[16]
        s22r, s22i = uv[17], uv[18]
    else
        s11r, s11i = uv[1], uv[2]
        s12r, s12i = uv[5], uv[6]
        s21r, s21i = uv[13], uv[14]
        s22r, s22i = uv[17], uv[18]
    end
    rho0 = 0.5 * (s11r + s22r)
    rho1 = -0.5 * (s12i + s21i)
    rho2 = 0.5 * (s21r - s12r)
    rho3 = 0.5 * (s22i - s11i)
    rho = sqrt(rho0 * rho0 + rho1 * rho1 + rho2 * rho2 + rho3 * rho3)
    state, sample0, sample1, sample2, sample3 =
        _fast_web_kennedy_pendleton_state(state, (2.0 * beta / 3.0) * rho, inverse_scale)
    if rho <= 1.0e-14
        return state, sample0, sample1, sample2, sample3
    end
    inverse_rho = inv(rho)
    v0 = rho0 * inverse_rho
    v1 = rho1 * inverse_rho
    v2 = rho2 * inverse_rho
    v3 = rho3 * inverse_rho
    return (
        state,
        sample0 * v0 - sample1 * v1 - sample2 * v2 - sample3 * v3,
        sample0 * v1 + sample1 * v0 - sample2 * v3 + sample3 * v2,
        sample0 * v2 + sample2 * v0 - sample3 * v1 + sample1 * v3,
        sample0 * v3 + sample3 * v0 - sample1 * v2 + sample2 * v1,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_heatbath_sweep!(field, beta, rng_state, reunitarize_links)
    accepted = 4 * field.volume
    offered = accepted
    plaquette_delta = 0.0
    state = rng_state[1]
    inverse_scale = inv(Float64(WEB_RNG_MASK))
    spatial_volume = field.nx * field.ny * field.nz
    polyakov_line_index = 1
    for site in 1:field.volume
        for direction in 1:4
            old = _fast_su3_link(field, site, direction)
            staple = _fast_su3_staple_site(field, site, direction)
            proposed = old
            uv = _fast_su3_multiply(proposed, staple)
            old_trace = _fast_su3_trace(uv)[1]
            for pair in 1:3
                state, a0, a1, a2, a3 = _fast_su3_heatbath_subgroup_state(
                    state,
                    uv,
                    pair,
                    beta,
                    inverse_scale,
                )
                proposed = _fast_su3_proposed_link(proposed, pair, a0, a1, a2, a3)
                uv = _fast_su3_proposed_link(uv, pair, a0, a1, a2, a3)
            end
            if reunitarize_links
                proposed = _fast_su3_reunitarize(proposed)
            end
            plaquette_delta += _fast_su3_trace(uv)[1] - old_trace
            _fast_su3_set_link!(field, site, direction, proposed)
            if direction == 4
                field.polyakov_dirty[polyakov_line_index] = true
            end
        end
        polyakov_line_index += 1
        if polyakov_line_index > spatial_volume
            polyakov_line_index = 1
        end
    end
    rng_state[1] = state
    if reunitarize_links
        field.plaquette_valid[1] = false
    elseif field.plaquette_valid[1]
        field.plaquette_sum[1] += plaquette_delta
    end
    return accepted, offered, plaquette_delta
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_sweep_degenerate!(field, beta, epsilon, rng_state)
    accepted = 0
    offered = 0
    state = rng_state[1]
    for site in 1:field.volume
        for direction in 1:4
            offered += 1
            pair = mod(offered - 1, 3) + 1
            state, a0, a1, a2, a3, uniform_draw =
                _fast_su3_proposal_and_draw_state(state, epsilon)
            old = _fast_su3_link(field, site, direction)
            proposed = _fast_su3_proposed_link(old, pair, a0, a1, a2, a3)
            old_sum = _fast_su3_affected_sum(field, site, direction)
            _fast_su3_set_link!(field, site, direction, proposed)
            new_sum = _fast_su3_affected_sum(field, site, direction)
            _fast_su3_set_link!(field, site, direction, old)
            delta_action = -(beta / 3.0) * (new_sum - old_sum)
            if delta_action <= 0.0 || uniform_draw < exp(-delta_action)
                _fast_su3_set_link!(field, site, direction, proposed)
                accepted += 1
                if direction == 4
                    line_index = mod(site - 1, field.nx * field.ny * field.nz) + 1
                    field.polyakov_dirty[line_index] = true
                end
            end
        end
    end
    rng_state[1] = state
    field.plaquette_valid[1] = false
    return accepted, offered, 0.0
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_sweep!(field, beta, epsilon, rng_state)
    if field.nx > 1 && field.ny > 1 && field.nz > 1 && field.nt > 1
        return _fast_su3_sweep_staple!(field, beta, epsilon, rng_state)
    end
    return _fast_su3_sweep_degenerate!(field, beta, epsilon, rng_state)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_normalized_plaquette(field)
    if !field.plaquette_valid[1]
        total = 0.0
        for site in 1:field.volume
            for mu in 1:3
                for nu in (mu + 1):4
                    total += _fast_su3_trace(
                        _fast_su3_plaquette_site(field, site, mu, nu),
                    )[1]
                end
            end
        end
        field.plaquette_sum[1] = total
        field.plaquette_valid[1] = true
    end
    return field.plaquette_sum[1] / (18.0 * field.volume)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_polyakov(field)
    total_real = 0.0
    total_imag = 0.0
    spatial_volume = field.nx * field.ny * field.nz
    for z in 1:field.nz
        for y in 1:field.ny
            for x in 1:field.nx
                line_index = x + field.nx * ((y - 1) + field.ny * (z - 1))
                if field.polyakov_dirty[line_index]
                    product = _fast_su3_identity()
                    for t in 1:field.nt
                        site = _fast_su3_site(field, x, y, z, t)
                        product = _fast_su3_multiply(product, _fast_su3_link(field, site, 4))
                    end
                    line_real, line_imag = _fast_su3_trace(product)
                    field.polyakov_lines_real[line_index] = line_real
                    field.polyakov_lines_imag[line_index] = line_imag
                    field.polyakov_dirty[line_index] = false
                end
                total_real += field.polyakov_lines_real[line_index]
                total_imag += field.polyakov_lines_imag[line_index]
            end
        end
    end
    normalization = 3.0 * spatial_volume
    return total_real / normalization, total_imag / normalization
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_local_energy_site(field, site)
    total = 0.0
    for mu in 1:3
        for nu in (mu + 1):4
            trace_value = _fast_su3_trace(
                _fast_su3_plaquette_site(field, site, mu, nu),
            )[1]
            total += 1.0 - trace_value / 3.0
        end
    end
    return total
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_plane_axes(plane)
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

function _fast_su3_slice_plan(field, plane, slice)
    first_axis, second_axis, first_fixed_axis, second_fixed_axis = _fast_su3_plane_axes(plane)
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
                _fast_su3_site(field, x, y, z, t)
        end
    end
    return width, height, sites
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_slice_from_plan!(output, field, sites)
    for index in 1:length(sites)
        output[index] = _fast_su3_local_energy_site(field, sites[index])
    end
    return output
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_encode_configuration(field)
    output = Vector{Float64}(undef, length(field.links))
    for index in 1:length(field.links)
        output[index] = field.links[index]
    end
    return output
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _fast_su3_decode_configuration(nx, ny, nz, nt, configuration)
    field = _fast_su3_field(nx, ny, nz, nt)
    if length(configuration) != length(field.links)
        throw(DimensionMismatch("invalid SU(3) configuration length"))
    end
    for index in 1:length(field.links)
        value = Float64(configuration[index])
        if !isfinite(value)
            throw(ArgumentError("configuration state must be finite"))
        end
        field.links[index] = value
    end
    return field
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

struct FastWebSu3Session
    field::FastWebSu3Field
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

function _fast_su3_session(
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
    algorithm="metropolis",
)
    if completed_sweeps < 0
        throw(ArgumentError("completed_sweeps must be nonnegative"))
    end
    algorithm_name = _fast_web_validate_algorithm(algorithm, nx, ny, nz, nt)
    rng_state = isempty(configuration) ? web_rng_state(seed_or_rng_state) :
                restore_web_rng_state(seed_or_rng_state)
    field = isempty(configuration) ?
            _fast_su3_initialize(nx, ny, nz, nt, condition, rng_state) :
            _fast_su3_decode_configuration(nx, ny, nz, nt, configuration)
    width, height, slice_sites = _fast_su3_slice_plan(field, plane, slice)
    slice_buffer = zeros(Float64, width * height)
    _fast_su3_normalized_plaquette(field)
    _fast_su3_polyakov(field)
    return FastWebSu3Session(
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

function _fast_su3_encode_session_chunk(
    session::FastWebSu3Session,
    chunk_sweeps::Int64,
    include_configuration::Bool,
    frames::Vector{Float64},
    plaquette_history::Vector{Float64},
    polyakov_real_history::Vector{Float64},
    polyakov_imag_history::Vector{Float64},
    acceptance_history::Vector{Float64},
    total_accepted::Int64,
    total_offered::Int64,
)
    field = session.field
    final_plaquette = chunk_sweeps == 0 ? _fast_su3_normalized_plaquette(field) :
                       plaquette_history[chunk_sweeps]
    final_polyakov_real, final_polyakov_imag = chunk_sweeps == 0 ?
                                               _fast_su3_polyakov(field) :
                                               (
        polyakov_real_history[chunk_sweeps],
        polyakov_imag_history[chunk_sweeps],
    )
    session.completed_sweeps[1] += chunk_sweeps
    configuration = include_configuration ? _fast_su3_encode_configuration(field) : Float64[]
    return _fast_web_encode_session_chunk(
        3,
        field.nx,
        field.ny,
        field.nz,
        field.nt,
        chunk_sweeps,
        include_configuration,
        session.completed_sweeps[1],
        final_plaquette,
        final_polyakov_real,
        final_polyakov_imag,
        total_accepted,
        total_offered,
        session.width,
        session.height,
        session.rng_state[1],
        plaquette_history,
        polyakov_real_history,
        polyakov_imag_history,
        acceptance_history,
        frames,
        configuration,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function _run_fast_su3_session_chunk!(
    session::FastWebSu3Session,
    chunk_sweeps::Int64,
    include_configuration::Bool,
)
    _fast_web_validate_chunk_sweeps(chunk_sweeps)
    field = session.field
    frame_size = session.width * session.height
    frames = Vector{Float64}(undef, (chunk_sweeps + 1) * frame_size)
    _fast_su3_slice_from_plan!(session.slice_buffer, field, session.slice_sites)
    _fast_web_copy_frame!(frames, 0, frame_size, session.slice_buffer)
    plaquette_history = Vector{Float64}(undef, chunk_sweeps)
    polyakov_real_history = Vector{Float64}(undef, chunk_sweeps)
    polyakov_imag_history = Vector{Float64}(undef, chunk_sweeps)
    acceptance_history = Vector{Float64}(undef, chunk_sweeps)
    total_accepted = 0
    total_offered = 0
    for sweep_index in 1:chunk_sweeps
        accepted, offered, _ = if session.algorithm == "heatbath"
            global_sweep = session.completed_sweeps[1] + sweep_index
            _fast_su3_heatbath_sweep!(
                field,
                session.beta,
                session.rng_state,
                mod(global_sweep, 32) == 0,
            )
        else
            _fast_su3_sweep!(field, session.beta, session.epsilon, session.rng_state)
        end
        total_accepted += accepted
        total_offered += offered
        plaquette_history[sweep_index] = _fast_su3_normalized_plaquette(field)
        polyakov_real, polyakov_imag = _fast_su3_polyakov(field)
        polyakov_real_history[sweep_index] = polyakov_real
        polyakov_imag_history[sweep_index] = polyakov_imag
        acceptance_history[sweep_index] = accepted / offered
        _fast_su3_slice_from_plan!(session.slice_buffer, field, session.slice_sites)
        frame_offset = sweep_index * frame_size
        _fast_web_copy_frame!(frames, frame_offset, frame_size, session.slice_buffer)
    end
    return _fast_su3_encode_session_chunk(
        session,
        chunk_sweeps,
        include_configuration,
        frames,
        plaquette_history,
        polyakov_real_history,
        polyakov_imag_history,
        acceptance_history,
        total_accepted,
        total_offered,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function run_fast_su3_chunk_web(
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
    algorithm="metropolis",
)
    session = _fast_su3_session(
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
        algorithm=algorithm,
    )
    return _run_fast_su3_session_chunk!(session, chunk_sweeps, true)
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function start_fast_su3_web_session(
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
    algorithm="metropolis",
)
    return _fast_su3_session(
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
        algorithm=algorithm,
    )
end

#= GAUGEFIELDSLITE_REPL_FRAGMENT =#

function run_fast_su3_web_session_chunk!(session::FastWebSu3Session, chunk_sweeps::Int64)
    return _run_fast_su3_session_chunk!(session, chunk_sweeps, false)
end


function reconfigure_fast_su3_web_session(
    session::FastWebSu3Session,
    plane,
    slice,
)
    width, height, slice_sites = _fast_su3_slice_plan(session.field, plane, slice)
    return FastWebSu3Session(
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
