import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { parseCSV } from './utilities.js';

const CAPTUREON = import.meta.env.VITE_CAPTUREON;
const CAPTURESECONDS = import.meta.env.VITE_CAPTURESECONDS;
const MOVIENUMBER = import.meta.env.VITE_MOVIENUMBER;
const MAXPOINTS = import.meta.env.VITE_MAXPOINTS;

const colors = [];
colors.push(0x3E8914);
colors.push(0x17BEBB);

const csvUrls = [];
csvUrls.push('trajectories/embeddingDiagram/cameraTrajectory.csv');
csvUrls.push('trajectories/embeddingDiagram/ray1.csv');
csvUrls.push('trajectories/embeddingDiagram/ray2.csv');

// Map over the URLs and return an array of promises
const fetchPromises = csvUrls.map(url =>
  fetch(url).then(response => response.text())
);

// Use Promise.all to wait for all fetch requests to complete
Promise.all(fetchPromises)
  .then(csvTexts => {
    // csvTexts is an array containing the contents of each CSV file as text
    const trajectories = csvTexts.map(csvText => parseCSV(csvText));
    process(trajectories[0], trajectories.slice(1));
  })
  .catch(error => {
    console.error('Error fetching one or more CSV files:', error);
  });


function process(cameraTrajectory, rayTrajectories) {
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
	const cameraCenter = new THREE.Vector3(0, 0, -10);

	camera.up.set(0, 0, 1);
	camera.position.x = 0;
	camera.position.y = -20;
	camera.position.z = 10;
	camera.lookAt(cameraCenter)

	const renderer = new THREE.WebGLRenderer();
	renderer.setSize( window.innerWidth, window.innerHeight );
	document.body.appendChild( renderer.domElement );

	addThroat(scene);
  	const rayMeshes = addRays(scene, rayTrajectories.length);
  	const [trails, currPoints] = addTrails(scene, rayTrajectories.length, rayTrajectories.map(matrix => matrix[0]));

	let i = 0;
	function animate() {
		requestAnimationFrame( animate );

    	camera.position.set(cameraTrajectory[i][0],cameraTrajectory[i][1],cameraTrajectory[i][2]); // Positioned 10 units above the x-y plane
    	camera.lookAt(cameraCenter);

		for (let j = 0; j < rayMeshes.length; j++){
			rayMeshes[j].position.set(rayTrajectories[j][i][0], rayTrajectories[j][i][1], rayTrajectories[j][i][2])
		updateTrail(rayMeshes[j], trails[j], currPoints, j)
		}
		i += 2

		renderer.render( scene, camera );
	}

	animate();
}

function addThroat(scene) {
	const objLoader = new OBJLoader();
	objLoader.load('models/surface.obj', function (object) {
		scene.add(object);
	});
}

function addRays(scene, numRays) {
  const rayMeshes = [];
  for (let i = 0; i < numRays; i++){
    const rayMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 32, 32),
      new THREE.MeshBasicMaterial({ color: colors[i] })
    );
    rayMeshes.push(rayMesh);
    scene.add(rayMesh);
  }

  return rayMeshes
}

function addTrails(scene, numRays, initialPositions) {
  let trails = [];
  let currPoints = [];
  for (let i = 0; i < numRays; i++) {
    const trailGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAXPOINTS * 3);
    for (let j = 0; j < positions.length; j += 3) {
      positions[j] = initialPositions[i][0];
      positions[j+1] = initialPositions[i][1];
      positions[j+2] = initialPositions[i][2];
    }
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({ color: colors[i], linewidth: 3 });
    const trail = new THREE.Line(trailGeometry, trailMaterial)
    currPoints.push(0);
    trails.push(trail);
    scene.add(trail);
  }

  return [trails, currPoints];
}

function updateTrail(object, trail, points, idx) {
  const trailGeometry = trail.geometry;
  const positionAttribute = trailGeometry.attributes.position;

  // Shift the positions back to make room for the new point
  for (let i = positionAttribute.count - 1; i > 0; i--) {
    const prevIndex = (i - 1) * 3;
    const currentIndex = i * 3;
    positionAttribute.array[currentIndex] = positionAttribute.array[prevIndex];
    positionAttribute.array[currentIndex + 1] = positionAttribute.array[prevIndex + 1];
    positionAttribute.array[currentIndex + 2] = positionAttribute.array[prevIndex + 2];
  }

  // Add the object's current position as the new point at the front of the trail
  positionAttribute.array[0] = object.position.x;
  positionAttribute.array[1] = object.position.y;
  positionAttribute.array[2] = object.position.z;

  // Notify Three.js that the positions need updating
  positionAttribute.needsUpdate = true;
}