import * as THREE from 'three';
import { parseCSV } from './utilities.js';

// Grab environment variables which I use as CLI arguments / switches.
const CAPTUREON = import.meta.env.VITE_CAPTUREON;
const CAPTURESECONDS = import.meta.env.VITE_CAPTURESECONDS;
const MOVIENUMBER = import.meta.env.VITE_MOVIENUMBER;
const MAXPOINTS = import.meta.env.VITE_MAXPOINTS;

/*
* Depending on the movie we are rendering, we set up the various ray 
* trajectory colors. We also point to the MMA generated ray trajectories 
* which are stored as csv files.
*/
const colors = [];
const csvUrls = [];
if (MOVIENUMBER == 1) {
  colors.push(0xff0000);
  colors.push(0x00ff00);
  colors.push(0x48B8D0);

  csvUrls.push('trajectories/subsupercritical/cameraTrajectory.csv');
  csvUrls.push('trajectories/subsupercritical/ray1.csv');
  csvUrls.push('trajectories/subsupercritical/ray2.csv');
  csvUrls.push('trajectories/subsupercritical/ray3.csv');
} else if (MOVIENUMBER == 2) {
  colors.push(0xff0000);
  colors.push(0xff0000);
  colors.push(0x00ff00);
  colors.push(0x00ff00);
  colors.push(0x48B8D0);
  colors.push(0x48B8D0);

  csvUrls.push('trajectories/pairwise/cameraTrajectory.csv');
  csvUrls.push('trajectories/pairwise/ray1.csv');
  csvUrls.push('trajectories/pairwise/ray2.csv');
  csvUrls.push('trajectories/pairwise/ray3.csv');
  csvUrls.push('trajectories/pairwise/ray4.csv');
  csvUrls.push('trajectories/pairwise/ray5.csv');
  csvUrls.push('trajectories/pairwise/ray6.csv');
} else if (MOVIENUMBER == 3) {
  colors.push(0x32CD32);
  colors.push(0x17BEBB);

  csvUrls.push('trajectories/equatorial-rays/cameraTrajectory.csv');
  csvUrls.push('trajectories/equatorial-rays/ray1.csv');
  csvUrls.push('trajectories/equatorial-rays/ray2.csv');
} else if (MOVIENUMBER == 4) {
  colors.push(0xffffff);
  colors.push(0x3F84E5);
  colors.push(0xBAFF29);
  colors.push(0xffffff);
  colors.push(0x3F84E5);
  colors.push(0xBAFF29);
  colors.push(0xffffff);
  colors.push(0x3F84E5);
  colors.push(0xBAFF29);

  csvUrls.push('trajectories/tau/cameraTrajectory.csv');
  csvUrls.push('trajectories/tau/ray1FullyTraced.csv');
  csvUrls.push('trajectories/tau/ray1.csv');
  csvUrls.push('trajectories/tau/ray1projection.csv');
} else if (MOVIENUMBER == 5) {
  colors.push(0xffffff);
  colors.push(0x3F84E5);
  colors.push(0xBAFF29);

  csvUrls.push('trajectories/tau/cameraTrajectory.csv');
  csvUrls.push('trajectories/sequential-cross-times/ray1.csv');
  csvUrls.push('trajectories/sequential-cross-times/ray2.csv');
  csvUrls.push('trajectories/sequential-cross-times/ray3.csv');
}else {
  throw new Error('Unknown movie number!');
}

// Map over the URLs and return an array of promises.
const fetchPromises = csvUrls.map(url =>
  fetch(url).then(response => response.text())
);

// Use Promise.all to wait for all fetch requests to complete.
Promise.all(fetchPromises)
  .then(csvTexts => {
    // csvTexts is an array containing the contents of each CSV file as text.
    const trajectories = csvTexts.map(csvText => parseCSV(csvText));
    process(trajectories[0], trajectories.slice(1));
  })
  .catch(error => {
    console.error('Error fetching one or more CSV files:', error);
  });

/*
* This is the main body of code. It is called once all of the fetch requests
* above complete. It is passed a camera trajectory and an array of light ray 
* trajectories, which themselves are arrays of vectors (x,y,z coordinates).
*/
function process(cameraTrajectory, rayTrajectories) {
  // Set up the THREE.js scene.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  const cameraCenter = new THREE.Vector3(0, 0, 0);
  const renderer = new THREE.WebGLRenderer();
  const textureLoader = new THREE.TextureLoader();
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  let fullyTracedTrajectory;
  if (MOVIENUMBER == 4) {
    fullyTracedTrajectory = rayTrajectories[0]; // The first ray is the fully traced trajectory
    rayTrajectories = rayTrajectories.slice(1, rayTrajectories.length); // The rest are the segment + projection of segment
  }

  // Add all of the scene elements.
  addBlackHole(scene);
  addSpinAxis(scene);
  addSkyDome(scene, textureLoader);
  const rayMeshes = addRays(scene, rayTrajectories.length);
  let trails 
  if (MOVIENUMBER == 4) {
    trails = addTrails(scene, rayTrajectories.length, rayTrajectories.map(matrix => matrix[0]));
  } else {
    trails = addTrails(scene, rayTrajectories.length, rayTrajectories.map(matrix => matrix[0]));
  }
  if (MOVIENUMBER == 2) { addRadialAxis(scene); }
  // if (MOVIENUMBER == 4) { addConcentricCircles(scene); }
  if (MOVIENUMBER == 4) { addFullyTracedRay(scene, fullyTracedTrajectory); }

  let redRingMaterial; // need a reference to the red ring material to make it pulse later
  if (MOVIENUMBER == 4) { redRingMaterial = addRedRing(scene); }

  const capturer = new CCapture({
    format: 'webm',
    framerate: 60
  });
  if (CAPTUREON == 1) { capturer.start(); }

  let i = 0; // This index is used for movies 1 - 3

  let currTrajectoryIdx = 0; // These indices are used for movie 4
  let currTrajectoryCoordIdx = 0; // These indices are used for movie 4
  let cameraIdx = 0; // These indices are used for movie 4
  let colorIdx = 1; // These indices are used for movie 4

  let startTime, startPhi;
  if (MOVIENUMBER == 4) {
    startTime = Number(rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][3]);
    startPhi  = Number(rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][4]);
  }

  let animationId;
  camera.up.set(0, 0, 1);

  // UI references
  const deltaPhiReadout  = document.getElementById('deltaPhiReadout');
  const deltaTReadout    = document.getElementById('deltaTReadout');
  const deltaReadoutItem = document.getElementById('delta-readout-item');
  const deltaReadoutValue= document.getElementById('delta-readout-value');
  const tauReadoutItem   = document.getElementById('tau-readout-item');
  const tauReadoutValue  = document.getElementById('tau-readout-value');
  const rightReadoutPanel= document.getElementById('right-readout-panel');

  const pulseAngularVelocity = 10.0;
  const pulsePhase = 0.25 * pulseAngularVelocity; // Shift in seconds
  let redRingIsPulsing = false;
  let startPulseTime;
  const endPulseTime = 2.0; // Seconds
  const numPulses = 3.0;

  // Function that runs every frame.
  function animate() {
	  animationId = requestAnimationFrame( animate );

    /*
    * For each light ray, update the position of the photon. Also update the corresponding 
    * ray trail. The logic is slightly different for movie 4.
    */
    if (MOVIENUMBER == 4) {
      camera.position.set(cameraTrajectory[cameraIdx][0],cameraTrajectory[cameraIdx][1],cameraTrajectory[cameraIdx][2]); 
      camera.lookAt(cameraCenter);

      let currProjectedTrajectoryIdx = currTrajectoryIdx + 1;

      // Update the actual trajectory and its trail
      rayMeshes[currTrajectoryIdx].position.set(rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][0], 
                                                rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][1], 
                                                rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][2]);
      updateTrail(rayMeshes[currTrajectoryIdx], trails[currTrajectoryIdx]);

      // Update the projected trajectory and its trail
      rayMeshes[currProjectedTrajectoryIdx].position.set( rayTrajectories[currProjectedTrajectoryIdx][currTrajectoryCoordIdx][0], 
                                                          rayTrajectories[currProjectedTrajectoryIdx][currTrajectoryCoordIdx][1], 
                                                          rayTrajectories[currProjectedTrajectoryIdx][currTrajectoryCoordIdx][2]);
      updateTrail(rayMeshes[currProjectedTrajectoryIdx], trails[currProjectedTrajectoryIdx]);

      // Update the UI
      let currentTime         = Number(rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][3]);
      let currentPhiInRadians = Number(rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][4]);

      let deltaT              = Math.abs(currentTime - startTime);
      let deltaPhiInRadians   = Math.abs(currentPhiInRadians - startPhi);
      let deltaPhiInDegs      = radiansToDegrees(deltaPhiInRadians);

      deltaPhiReadout.innerText = formatNumber(deltaPhiInDegs) + '°';
      deltaTReadout.innerText   = formatNumber(deltaT) + 'M';

      const currPulseTime = performance.now() * 0.001; // Convert to seconds

      // Pulse red ring logic 
      if (redRingIsPulsing) {
        const pulseTime = currPulseTime - startPulseTime;
        const period = (2.0 * Math.PI) / pulseAngularVelocity;
        const numCycles = pulseTime / period;

        if (numCycles < numPulses) {
          redRingMaterial.opacity = (Math.sin(pulseAngularVelocity * pulseTime + pulsePhase) + 1.0) / 2.0;
        } else {
          redRingMaterial.opacity = 1.0;
          redRingIsPulsing = false;
        }
      }

      // If the current position is an equatorial crossing, reset various counters
      if (Number(rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx][5]) === 1) {
        deltaReadoutValue.innerText = formatNumber(deltaPhiInDegs) + '°';
        // We hard code here since NDSolve isn't sufficiently precise for constant tau
        tauReadoutValue.innerText   = formatNumber(16.85) + 'M';

        deltaReadoutValue.classList.remove('transparent');
        tauReadoutValue.classList.remove('transparent');

        /* Pulse the text */
        deltaReadoutValue.classList.add('pulse-text');
        tauReadoutValue.classList.add('pulse-text');

        function onDeltaPulseAnimationEnd() {
          deltaReadoutValue.classList.remove('pulse-text');
        }

        function onTauPulseAnimationEnd() {
          tauReadoutValue.classList.remove('pulse-text');
        }

        deltaReadoutValue.removeEventListener('animationend', onDeltaPulseAnimationEnd)
        deltaReadoutValue.addEventListener('animationend', onDeltaPulseAnimationEnd)

        tauReadoutValue.removeEventListener('animationend', onTauPulseAnimationEnd)
        tauReadoutValue.addEventListener('animationend', onTauPulseAnimationEnd)
        /* Pulse the text */

        startTime = currentTime;
        startPhi = currentPhiInRadians;

        // Reset the trail of the projection
        resetTrail(rayMeshes[currProjectedTrajectoryIdx], trails[currProjectedTrajectoryIdx]);
        trails[currProjectedTrajectoryIdx].material.color.set(colors[colorIdx]);

        // Create a new trail for the next segment and replace the old one so that it no longer 
        // receives animation updates.
        let returnedTrail = addTrail(scene, rayTrajectories[currTrajectoryIdx][currTrajectoryCoordIdx], colors[colorIdx]);
        trails[currTrajectoryIdx] = returnedTrail;

        colorIdx++;

        // Pulse red ring logic 
        redRingIsPulsing = true;
        startPulseTime = currPulseTime;
      }

      /* 
      * For movie 4, we animate the trajectories two at a time (the trajectory and its equatorial projection), 
      * with pairs proceeding in sequence.
      */
      currTrajectoryCoordIdx += 1;
      if (currTrajectoryCoordIdx == rayTrajectories[currTrajectoryIdx].length) {
        currTrajectoryIdx = (currTrajectoryIdx + 1) % rayTrajectories.length; 
        currTrajectoryCoordIdx = 0;
      }

      cameraIdx += 1;
    } else {
      camera.position.set(cameraTrajectory[i][0],cameraTrajectory[i][1],cameraTrajectory[i][2]); 
      camera.lookAt(cameraCenter);

      for (let j = 0; j < rayMeshes.length; j++){
        // Update the photon position.
        rayMeshes[j].position.set(rayTrajectories[j][i][0], rayTrajectories[j][i][1], rayTrajectories[j][i][2]);

        // Now update the trail.
        updateTrail(rayMeshes[j], trails[j]);
      }
	    i = i + 1;
    }
	  renderer.render( scene, camera );

    if (CAPTUREON == 1) { 
      console.log('capturing!')
      capturer.capture( renderer.domElement ); 
    }
  }

  animate();

  if (CAPTUREON == 1) {
    setTimeout(() => {
      cancelAnimationFrame(animationId);
      capturer.stop();
      capturer.save();
    }, CAPTURESECONDS * 1000);
  }
}

/* 
* Function responsible for updating the trails of each light ray.
*/ 
function updateTrail(object, trail) {
  const trailGeometry = trail.geometry;

  /*
  * Obtain a reference to the the position data. Remember, it is a flat array of position data
  * for the trail nodes, x1,y1,z1,x2,y2,z2,...
  */
  const positionAttribute = trailGeometry.attributes.position;

  // Shift the positions back to make room for the new point.
  for (let i = positionAttribute.count - 1; i > 0; i--) {
    const prevIndex = (i - 1) * 3;
    const currentIndex = i * 3;
    positionAttribute.array[currentIndex] = positionAttribute.array[prevIndex];
    positionAttribute.array[currentIndex + 1] = positionAttribute.array[prevIndex + 1];
    positionAttribute.array[currentIndex + 2] = positionAttribute.array[prevIndex + 2];
  }

  // Add the object's current position as the new point at the front of the trail.
  positionAttribute.array[0] = object.position.x;
  positionAttribute.array[1] = object.position.y;
  positionAttribute.array[2] = object.position.z;

  // Notify Three.js that the positions need updating.
  positionAttribute.needsUpdate = true;

  trail.computeLineDistances();
}

function resetTrail(object, trail) {
  const trailGeometry = trail.geometry;
  const positionAttribute = trailGeometry.attributes.position;

  for (let i = 0; i < positionAttribute.count; i++) {
    const currentIndex = i * 3;
    positionAttribute.array[currentIndex] = object.position.x;
    positionAttribute.array[currentIndex + 1] = object.position.y;
    positionAttribute.array[currentIndex + 2] = object.position.z;
  }

  // Notify Three.js that the positions need updating.
  positionAttribute.needsUpdate = true;

  trail.computeLineDistances();

}

function addRays(scene, numRays) {
  const rayMeshes = [];

  for (let i = 0; i < numRays; i++){
    const rayMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 32, 32),
      new THREE.MeshBasicMaterial({ color: colors[i] })
    );
    rayMeshes.push(rayMesh);
    scene.add(rayMesh);
  }

  return rayMeshes
}

function addTrails(scene, numRays, initialPositions) {
  let trails = [];

  // Iterate through the rays.
  for (let i = 0; i < numRays; i++) {
    // This is the THREE object that will encapsulate the trail.
    const trailGeometry = new THREE.BufferGeometry();

    /*
    * This is a flattened array that contains the position data of 
    * the nodes in the trail: x1,y1,z1,x2,y2,z2,... 
    * 
    * We initialize all trail nodes to start at the initial position
    * of the ray trajectory.
    */
    const positions = new Float32Array(MAXPOINTS * 3);

    for (let j = 0; j < positions.length; j += 3) {
      positions[j] = initialPositions[i][0];
      positions[j+1] = initialPositions[i][1];
      positions[j+2] = initialPositions[i][2];
    }

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let trailMaterial; 
    if (MOVIENUMBER == 4) {
      if (i % 2 == 0) {
        trailMaterial = new THREE.LineBasicMaterial({ color: colors[0], linewidth: 3 });
      } else {
        trailMaterial = new THREE.LineDashedMaterial({
          color: colors[0],
          dashSize: 0.5,
          gapSize: 2,
          linewidth: 2
        });
      }
    } else {
      trailMaterial = new THREE.LineBasicMaterial({ color: colors[i], linewidth: 3 });
    }

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.computeLineDistances();

    trails.push(trail);
    scene.add(trail);
  }

  return trails;
}

function addTrail(scene, initialPosition, color) {
  const trailGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAXPOINTS * 3);

  for (let j = 0; j < positions.length; j += 3) {
    positions[j] = initialPosition[0];
    positions[j+1] = initialPosition[1];
    positions[j+2] = initialPosition[2];
  }
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const trailMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
  let trail = new THREE.Line(trailGeometry, trailMaterial);

  scene.add(trail);
  return trail;
}

function addSkyDome(scene, textureLoader) {
  const skyGeometry = new THREE.SphereGeometry(2000, 60, 40);
  const skyTexture = textureLoader.load('eso0932a.jpg'); 

  skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide
  });
  const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);

  skyDome.position.set(0,0,0);
  skyDome.rotateX(Math.PI/2.0)

  scene.add(skyDome);
}

function addEquatorialDisk(scene) {
  const radiusTop = 40;        // Radius at the top of the cylinder
  const radiusBottom = 40;     // Radius at the bottom of the cylinder
  const height = 0.01;        // Height of the cylinder (very small to make it a disk)
  const radialSegments = 100;  // Number of segmented faces around the circumference of the disk
  const heightSegments = 1;   // Number of segmented faces along the height of the cylinder
  const openEnded = false;    // Whether the ends are open or capped

  const diskGeometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded);
  const diskMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x808080, 
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide 
  });
  const diskMesh = new THREE.Mesh(diskGeometry, diskMaterial);

  diskMesh.rotation.x = Math.PI / 2;

  scene.add(diskMesh);
}

function addRedRing(scene) {
  const epsilon = 1.0;
  const rcrit = 21.92;
  const radius = rcrit + epsilon;
  const curve = new THREE.EllipseCurve(
    0,  0,            // ax, aY
    radius, radius,   // xRadius, yRadius
    0,  2 * Math.PI,  // aStartAngle, aEndAngle
    false,            // aClockwise
    0                 // aRotation
  );

  const points = curve.getPoints(1000);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color: 0xFF3c38,
    linewidth: 3.0,
    transparent: true,
    opacity: 1.0,
  });
  const line = new THREE.Line(geometry, material);

  scene.add(line);

  return material; 
}

function addConcentricCircles(scene) {
  const N = 20;
  const radiusBase = 10;
  const radiusSpacing = 2;

  for (let i = 0; i < N; i++) {
    const radius = radiusBase + i * radiusSpacing;

    const curve = new THREE.EllipseCurve(
      0,  0,            // ax, aY
      radius, radius,           // xRadius, yRadius
      0,  2 * Math.PI,  // aStartAngle, aEndAngle
      false,            // aClockwise
      0                 // aRotation
    );

    const points = curve.getPoints(100); // 50 points for smoothness
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    const line = new THREE.Line(geometry, material);

    scene.add(line);
  }
}

function addFullyTracedRay(scene, fullyTracedTrajectory) {
  const positions = fullyTracedTrajectory.flat();

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
  });
  const line = new THREE.Line(geometry, material);

  scene.add(line);
}

function addBlackHole(scene) {
  const blackholeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(10.4, 64, 64), 
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );

  scene.add(blackholeMesh);
}

function addRadialAxis(scene) {
  const radialAxisPoints = [];

  radialAxisPoints.push(new THREE.Vector3(0, 0, 0));
  radialAxisPoints.push(new THREE.Vector3(40, 0, 0));

  const radialAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(radialAxisPoints), 
    new THREE.LineBasicMaterial({ color: 0xe1e1e1, linewidth: 2 })
  );

  scene.add(radialAxis)
}

function addSpinAxis(scene) {
  const axisPoints = [];

  axisPoints.push(new THREE.Vector3(0, 0, 15));
  axisPoints.push(new THREE.Vector3(0, 0, -15));

  const spinAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(axisPoints), 
    new THREE.LineBasicMaterial({ color: 0xe1e1e1, linewidth: 3 })
  );
  
  scene.add(spinAxis)
}

function cartesianToSpherical(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const theta = Math.acos(z / r);    // acos to get the polar angle
  const phi = Math.atan2(y, x);  // atan2 handles the quadrant correctly

  return { r, theta, phi };
}

function radiansToDegrees(theta) {
  return theta * (180.0 / Math.PI);
}

// Helper function to pad a number to align by decimal point
function formatNumber(num, precision = 2) {
  let [intPart, decPart] = num.toFixed(precision).split('.');
  intPart = intPart.padStart(3, ' '); // Adjust based on maximum expected length
  return `${intPart}.${decPart}`;
}
