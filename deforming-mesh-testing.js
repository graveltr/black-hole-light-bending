import * as THREE from 'three';
import { parseCSV } from './utilities.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// Grab environment variables which I use as CLI arguments / switches.
const CAPTUREON = import.meta.env.VITE_CAPTUREON;
const CAPTURESECONDS = import.meta.env.VITE_CAPTURESECONDS;
const MAXPOINTS = import.meta.env.VITE_MAXPOINTS;


const sceneOneCsvUrls = [];
const sceneOneBasePath = "trajectories/photon-sphere-to-photon-shell/scene1/"
sceneOneCsvUrls.push(sceneOneBasePath + "cameraTrajectory.csv");
const numLaunchPoints = 10;
const numLaunchAngles = 4;
for (let i = 0; i < numLaunchPoints; ++i) {
  for (let j = 0; j < numLaunchAngles; ++j) {
    sceneOneCsvUrls.push(sceneOneBasePath + "ray-" + String(i + 1) + "-" + String(j + 1) + ".csv");
  }
}
console.log("hello world");
console.log(sceneOneCsvUrls);

// Map over the URLs and return an array of promises.
// Both fetch and response.text return promises, thus 
// fetchPromises results in an array of promises.
const fetchPromises = sceneOneCsvUrls.map(url =>
  fetch(url).then(response => response.text())
);

// Use Promise.all to wait for all fetch requests to complete.
Promise.all(fetchPromises)
  .then(csvTexts => {
    // csvTexts is an array containing the contents of each CSV file as text.
    const trajectories = csvTexts.map(csvText => parseCSV(csvText));
    preprocess(trajectories[0], trajectories.slice(1));
  })
  .catch(error => {
    console.error('Error fetching one or more CSV files:', error);
  });

function preprocess(cameraTrajectory, rayTrajectories) {
  loadPhotonShellKeyframes().then(keyframes => {
    console.log("All keyframes loaded", keyframes);
    process(cameraTrajectory, rayTrajectories, keyframes);
  }).catch(error => {
    console.error("An error occurred while loading keyframes:", error);
  });
}

/*
* This is the main body of code. It is called once all of the fetch requests
* above complete. It is passed a camera trajectory and an array of light ray 
* trajectories, which themselves are arrays of vectors (x,y,z coordinates).
*/
function process(cameraTrajectory, rayTrajectories, photonShellKeyframes) {
  console.log("hello world");

  // rayTrajectories = rayTrajectories.slice(0,1)

  // Set up the THREE.js scene.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  const cameraCenter = new THREE.Vector3(0, 0, 0);
  const renderer = new THREE.WebGLRenderer();
  const textureLoader = new THREE.TextureLoader();

  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  const capturer = new CCapture({
    format: 'webm',
    framerate: 60
  });
  if (CAPTUREON == 1) { capturer.start(); }

  // UI References

  let i = 0;
  let animationId;
  camera.up.set(0, 0, 1);
  camera.position.set(0.0,5.0,0.0); 
  camera.lookAt(cameraCenter);

  const geometry = new THREE.BoxGeometry( 1, 1, 1 );
  const material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
  const cube = new THREE.Mesh( geometry, material );
  scene.add( cube );

  let currFramecount = 0;
  let currKeyframe = 0; 
  let currKeyframecount = 0;

  scene.add(photonShellKeyframes[currKeyframe]);

  function animate() {
    animationId = requestAnimationFrame( animate );

    if (currKeyframecount === 5) {
      scene.remove(photonShellKeyframes[currKeyframe]);
      currKeyframe = (currKeyframe + 1) % photonShellKeyframes.length;
      scene.add(photonShellKeyframes[currKeyframe]);
      currKeyframecount = 0;
    }

	  renderer.render( scene, camera );
    currFramecount = currFramecount + 1;
    currKeyframecount = currKeyframecount + 1;

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

function addConcentricRegionOne(scene) {
  const objLoader = new OBJLoader();
  objLoader.load('models/concentricSphereAnimation/concentricRegionOne.obj', function (object) {
      scene.add(object);
      console.log("successfully added object");
  })
}

/*
*  Returns a promise that resolves with the keyframes array once all keyframes
*  are loaded.
*/
function loadPhotonShellKeyframes() {
  const objLoader = new OBJLoader();
  const lastFrame = 80;
  const keyframes = [];
  const basePath = "models/photonShellAnimation/";
  
  const loadKeyframe = (path) => {
    return new Promise((resolve, reject) => {
      objLoader.load(
        path,
        object => resolve(object),
        undefined,
        error => reject(error)
      );
    });
  };

  const loadAllKeyframes = async () => {
    for (let i = 1; i <= lastFrame; i++) {
      const currKeyframePath = `${basePath}photon-shell-keyframe-${i}.obj`;
      console.log("loading: " + currKeyframePath);

      try {
        const object = await loadKeyframe(currKeyframePath);
        console.log("successfully loaded " + currKeyframePath);
        keyframes.push(object);
      } catch (error) {
        console.error("Error loading " + currKeyframePath, error);
      }
    }

    return keyframes;
  };

  return loadAllKeyframes();
}