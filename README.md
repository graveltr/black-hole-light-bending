[![2406.11671](https://img.shields.io/badge/arXiv-2406.11671-b31b1b.svg)](https://arxiv.org/abs/2406.11671) 
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

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

The movie numbers are described in the section that follows.

To select the embedding diagram animation, uncomment and comment the following lines 
in [the main html page](index.html)

```
<!-- <script type="module" src="/main.js"></script> -->
<script type="module" src="/embeddingDiagram.js"></script> 
```

This changes the main javascript file to <embeddingDiagram.js> rather than
<main.js>. The value of `VITE_MOVIENUMBER` is irrelevant when this file is 
used.


# Computation Workflow

The javascript files <main.js> and <embeddingDiagram.js> are responsible for 
rendering predefined trajectories, which are stored in `trajectories/`.

# Animation Descriptions

krt-subsupercritical.mp4:
Showcases 3 rays, emitted from the same location but with initial momenta tuned
such that one ray falls into the black hole, one ray is bound, and the other is
ejected to infinity.

krt-Lyapunov-long-trails.mp4:
Showcases 3 pairs of rays. In each pair, one of the rays is emitted with
momentum such that it is bound, while the other is shot with the same momentum
but perturbed slightly in radius by an amount delta r. The separation between
the rays in each pair increases as the trajectories undergo an increasing
number of half-orbits, with the separation rate determined by the Lyapunov
exponent. I have also included a plot of the value of the Lyapunov exponent as
one moves radially through the photon sphere, along with the selected radii and
corresponding Lyapunov values color coded to match the movie.

krt-Lyapunov-short-trails.mp4:
Same as the previous description, except I've shortened the length of the ray
trails to make the movie a bit less busy.

krt-equatorial-rays-with-embedding-diagram.mp4:
A side-by-side movie. The left-hand side shows equatorially orbiting rays about
a high-spin black hole that eventually eject to infinity. The rays start in the
same position, but one of the rays has a larger initial momentum, leading to
more rapid escape. On the right-hand side is the embedding diagram of the
equatorial plane along with the mapped ray trajectories. We see the photons
orbit and then climb out of the throat.
