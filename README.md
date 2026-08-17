# LatticeGaugePlayground.jl

**[Open the Lattice Gauge Theory Playground](https://akio-tomiya.github.io/LatticeGaugePlayground.jl/index.html)**

LatticeGaugePlayground.jl is a standalone educational Web application for
exploring small-lattice SU(2) and SU(3) gauge theory. The simulation runs
locally in the browser: no account, calculation server, or local Julia
installation is required.

The page visualizes the evolution of local plaquette action density and shows
the average plaquette, Polyakov loop, and plaquette history. It supports
Heatbath and Metropolis updates, reproducible random seeds, Run, Cancel,
Continue, Reset, and replay controls. The interface can be opened in
[English](https://akio-tomiya.github.io/LatticeGaugePlayground.jl/index.html?lang=en),
[日本語](https://akio-tomiya.github.io/LatticeGaugePlayground.jl/index.html?lang=ja),
or [中文（简体）](https://akio-tomiya.github.io/LatticeGaugePlayground.jl/index.html?lang=zh-Hans).

## Julia and lattice-QCD components

The browser calculation evaluates generated Julia source with
[SubsetJulia/WASM](https://github.com/terasakisatoshi/subset_julia) and the
[julia-vm-oss](https://github.com/AtelierArith/julia-vm-oss) runtime. Its
portable Heatbath physics kernels are synchronized from
[Gaugefields.jl](https://github.com/akio-tomiya/Gaugefields.jl), part of the
[JuliaQCD](https://github.com/JuliaQCD) ecosystem.

This playground is intended for education and scientific outreach. Its small
lattices and short Markov chains are not substitutes for production lattice
QCD calculations or precision physics analyses.

## This repository

This repository contains only the latest generated static Web deployment. It
is updated from the private development repository after the complete Julia,
physics, WebAssembly, provenance, and license gates pass. Files in this
repository are not edited by hand.

The source revision and pinned upstream revisions used for the current
deployment are recorded in [`BUILD_INFO.json`](./BUILD_INFO.json). Project and
third-party terms are provided in [`LICENSE`](./LICENSE) and
[`THIRD_PARTY_NOTICES.txt`](./THIRD_PARTY_NOTICES.txt).

To run a downloaded copy locally, serve the repository over HTTP rather than
opening `index.html` through `file://`:

```bash
python3 -m http.server 8767 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8767/index.html>.
