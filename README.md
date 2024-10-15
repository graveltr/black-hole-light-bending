[![2406.11671](https://img.shields.io/badge/arXiv-2406.11671-b31b1b.svg)](https://arxiv.org/abs/2406.11671) 
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

The code used to implement the various animations and diagrams that appear in
[2406.11671](https://arxiv.org/abs/2406.11671).

# Installation

Once you have cloned this repository, you will need to install the dependencies
using the Node package manager (https://nodejs.org/en/download/package-manager).

```
# installs nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash

# download and install Node.js (you may need to restart the terminal)
nvm install 20

# verifies the right Node.js version is in the environment
node -v # should print `v20.17.0`

# verifies the right npm version is in the environment
npm -v # should print `10.8.2`
```

Once npm is installed, you can install the project dependencies with 

```
npm install
```

If you have [make](https://www.gnu.org/software/make/), you can run an animation using
one of the following

```
make movieOne
make movieTwo
make movieThree
```

Look inside the [Makefile](Makefile) for the commands used to run the animations. There 
are several command line options that augment the behavior of the animation.

| Option       | Values | Description    |
|------------|-----|---------------|
| VITE_CAPTURESECONDS  | Positive integer | Sets the amount of seconds of video capture |
| VITE_CAPTUREON | 0 or 1  | Sets the video capture functionality off or on |
| VITE_MOVIENUMBER | 1,2,3  | Selects one of the three animations |
| VITE_MAXPOINTS | Positive integer  | Sets the length of the ray trails |

The movie numbers are described in [Animation Descriptions](#animation-descriptions).

To select the embedding diagram animation, uncomment and comment the following lines 
in [index.html](index.html).

```
<!-- <script type="module" src="/main.js"></script> -->
<script type="module" src="/embeddingDiagram.js"></script> 
```

This changes the main javascript file to [embeddingDiagram.js](embeddingDiagram.js) rather than
[main.js](main.js). The value of `VITE_MOVIENUMBER` is irrelevant when this file is 
used.


# Computation Workflow

The javascript files [main.js](main.js) and
[embeddingDiagram.js](embeddingDiagram.js) are responsible for rendering
predefined trajectories, which are stored in `trajectories/`. The
trajectories rendered by [main.js](main.js) are computed in [RayTracing.nb](RayTracing.nb) while 
the trajectories rendered by [embeddingDiagram.js](embeddingDiagram.js) are first computed in 
[EquatorialRays.nb](EquatorialRays.nb) and then transformed into the embedding space in 
[KerrEmbeddingDiagram.nb](KerrEmbeddingDiagram.nb). The latter notebook also computes the 
embedding diagram itself and exports the geometry to `models/`.

# Animation Descriptions

Below are brief descriptions of the various animations.

Kerr Ray Tracing Subsupercritical:
Showcases 3 rays, emitted from the same location but with initial momenta tuned
such that one ray falls into the black hole, one ray is bound, and the other is
ejected to infinity.

![subsupercritical](gifs/krt-subsupercritical.gif)

Kerr Ray Tracing Lyapunov:
Showcases 3 pairs of rays. In each pair, one of the rays is emitted with
momentum such that it is bound, while the other is shot with the same momentum
but perturbed slightly in radius by an amount delta r. The separation between
the rays in each pair increases as the trajectories undergo an increasing
number of half-orbits, with the separation rate determined by the Lyapunov
exponent. I have also included a plot of the value of the Lyapunov exponent as
one moves radially through the photon sphere, along with the selected radii and
corresponding Lyapunov values color coded to match the movie.

![lyapunov](gifs/krt-lyapunov.gif)

Kerr Ray Tracing Equatorial Rays:
Shows equatorially orbiting rays about a high-spin black hole that eventually
eject to infinity. The rays start in the same position, but one of the rays has
a larger initial momentum, leading to more rapid escape. 

![equatorial](gifs/krt-equatorial-rays.gif)

embeddingDiagram.js: Kerr Ray Tracing Embedded Equatorial Rays:
The same physical setup as Movie 3, but displayed in the embedding space.
We see the embedding diagram of the equatorial plane along with the mapped ray
trajectories. We see the photons orbit and then climb out of the throat.

![embedding](gifs/krt-embeddingDiagram.gif)
