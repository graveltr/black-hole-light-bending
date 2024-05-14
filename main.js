import * as THREE from 'three';

function getRandomBoolean() {
  return Math.random() >= 0.5;
}

function getRandomFloatOutsideInterval(halfWidth, maxDist) {
    const dist = (maxDist/2.0) + THREE.MathUtils.randFloatSpread(maxDist);
    return getRandomBoolean() ? -1 * halfWidth - dist : halfWidth + dist;
}

function sphericalToCartesian(r, theta, phi) {
  const x = r * Math.sin(theta) * Math.cos(phi);
  const y = r * Math.sin(theta) * Math.sin(phi);
  const z = r * Math.cos(theta);

  return { x, y, z };
}

// Function to parse CSV text into a matrix
function parseCSV(csvText) {
  return csvText.trim().split('\n').map(row => row.split(','));
}

// Array of CSV file URLs
const csvUrls = [
  'cameraTrajectory.csv',
  'ray1.csv',
  'ray2.csv',
  'ray3.csv'
];

// Map over the URLs and return an array of promises
const fetchPromises = csvUrls.map(url =>
  fetch(url).then(response => response.text())
);

// Use Promise.all to wait for all fetch requests to complete
Promise.all(fetchPromises)
  .then(csvTexts => {
    // csvTexts is an array containing the contents of each CSV file as text
    // You can now parse the CSV text and process the data as needed
    const trajectories = csvTexts.map(csvText => parseCSV(csvText));
    process(trajectories[0], trajectories.slice(1));
  })
  .catch(error => {
    console.error('Error fetching one or more CSV files:', error);
  });

function process(cameraTrajectory, rayTrajectories) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);

  const renderer = new THREE.WebGLRenderer();
  const textureLoader = new THREE.TextureLoader();
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  const blackholeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(13, 32, 32), 
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  scene.add(blackholeMesh);

  const colors = [0xff0000, 0x00ff00, 0x0000ff];
  const rayMeshes = [];
  for (let i = 0; i < rayTrajectories.length; i++){
    const rayMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 32, 32),
      new THREE.MeshBasicMaterial({ color: colors[i] })
    );
    rayMeshes.push(rayMesh);
    scene.add(rayMesh);
  }

  const maxPoints = 10000;
  let trails = [];
  let currPoints = [];
  for (let i = 0; i < rayMeshes.length; i++) {
    const trailGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({ color: colors[i], linewidth: 3 });
    const trail = new THREE.Line(trailGeometry, trailMaterial)
    currPoints.push(0);
    trails.push(trail);
    scene.add(trail);
  }

  function updateTrail(object, trail, points, idx) {
    const trailGeometry = trail.geometry;
    const positionAttribute = trailGeometry.attributes.position;

    positionAttribute.array[points[idx] * 3] = object.position.x;
    positionAttribute.array[points[idx] * 3 + 1] = object.position.y;
    positionAttribute.array[points[idx] * 3 + 2] = object.position.z;

    points[idx] = (points[idx] + 1) % maxPoints;
    positionAttribute.needsUpdate = true;

    // If the trail is shorter than the maxPoints, set the draw range to the current number of points
    if (points[idx] < maxPoints - 1) {
      trailGeometry.setDrawRange(0, points[idx]);
    } else {
      // Once the trail has reached its maximum length, we can use the entire buffer
      trailGeometry.setDrawRange(0, maxPoints);
    }
  }

/*   const particlesGeometry = new THREE.BufferGeometry();
  const starsVertices = [];
  for (let i = 0; i < 50000; i++) {
    const r = getRandomFloatOutsideInterval(200, 500);
    const theta = Math.random() * Math.PI;
    const phi = Math.random() * 2 * Math.PI;
    const cartesianCoords = sphericalToCartesian(r, theta, phi)
    starsVertices.push(cartesianCoords.x, cartesianCoords.y, cartesianCoords.z);
  }
  particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
  const particlesMaterial = new THREE.PointsMaterial({ color: 0xffffff });
  const starField = new THREE.Points(particlesGeometry, particlesMaterial);
  scene.add(starField); */

  const skyGeometry = new THREE.SphereGeometry(2000, 60, 40);
  const skyTexture = textureLoader.load('eso0932a.jpg'); // Replace with the path to your sky texture
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide
  });
  const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
  scene.add(skyDome);
  skyDome.position.set(0,0,0);
  skyDome.rotateX(Math.PI/2.0)

  const axisPoints = [];
  axisPoints.push(new THREE.Vector3(0, 0, 20));
  axisPoints.push(new THREE.Vector3(0, 0, -20));
  const spinAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(axisPoints), 
    new THREE.LineBasicMaterial({ color: 0xe1e1e1, linewidth: 5 })
  );
  scene.add(spinAxis)

  let i = 0;
  camera.up.set(0, 0, 1);

  const capturer = new CCapture({
    format: 'webm',
    framerate: 60
  });

  let animationId;
  capturer.start();

  function animate() {
	  animationId = requestAnimationFrame( animate );

    camera.position.set(cameraTrajectory[i][0],cameraTrajectory[i][1],cameraTrajectory[i][2]); // Positioned 10 units above the x-y plane
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    for (let j = 0; j < rayMeshes.length; j++){
	    rayMeshes[j].position.set(rayTrajectories[j][i][0], rayTrajectories[j][i][1], rayTrajectories[j][i][2])
      updateTrail(rayMeshes[j], trails[j], currPoints, j)
    }
	  i += 1
	  renderer.render( scene, camera );
    capturer.capture( renderer.domElement )
  }
  animate();
  setTimeout(() => {
    cancelAnimationFrame(animationId);
    capturer.stop();
    capturer.save();
  }, 15*1000);
}

