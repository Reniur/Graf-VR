'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let verticalPoints = 0;
let horizontalPoints = 0;
let stereoCamera;
let magRotation;
let sphereVertices, sphereUvs;
let vertices, uvs;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model() {

    this.BufferData = function() {
        const allVertices = vertices.concat(sphereVertices);
        const allUvs = uvs.concat(sphereUvs);
        const allBuffer = allVertices.concat(allUvs);

        // vertices
        const vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(allBuffer), gl.STREAM_DRAW);

        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(shProgram.iAttribTexcoord);
        gl.vertexAttribPointer(shProgram.iAttribTexcoord, 2, gl.FLOAT, false, 0, allVertices * 4);
    }
}

// Constructor
function ShaderProgram(name, program) {

    this.name = name;
    this.prog = program;

    // Location of the attribute variable in the shader program.
    this.iAttribVertex = -1;
    // Location of the uniform specifying a color for the primitive.
    this.iColor = -1;
    // Location of the uniform matrix representing the combined transformation.
    this.iModelViewProjectionMatrix = -1;

    this.Use = function() {
        gl.useProgram(this.prog);
    }
}

function leftFrustum(stereoCamera) {
    const { eyeSeparation, convergence, aspectRatio, fov, near, far } = stereoCamera;
    const top = near * Math.tan(fov / 2);
    const bottom = -top;

    const a = aspectRatio * Math.tan(fov / 2) * convergence;
    const b = a - eyeSeparation / 2;
    const c = a + eyeSeparation / 2;

    const left = -b * near / convergence;
    const right = c * near / convergence;

    return m4.frustum(left, right, bottom, top, near, far);
}

function rightFrustum(stereoCamera) {
    const { eyeSeparation, convergence, aspectRatio, fov, near, far } = stereoCamera;
    const top = near * Math.tan(fov / 2);
    const bottom = -top;

    const a = aspectRatio * Math.tan(fov / 2) * convergence;
    const b = a - eyeSeparation / 2;
    const c = a + eyeSeparation / 2;

    const left = -c * near / convergence;
    const right = b * near / convergence;
    return m4.frustum(left, right, bottom, top, near, far);
}

function drawLeft() {
    let projection = leftFrustum(stereoCamera); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
    if (magRotation) {
      matAccum1 = m4.multiply(matAccum1, magRotation);
    }

    const modelviewInv = m4.inverse(matAccum1, new Float32Array(16));
    const normalMatrix = m4.transpose(modelviewInv, new Float32Array(16));
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length / 3);
    gl.drawArrays(gl.TRIANGLE_STRIP, vertices.length / 3, sphereVertices.length / 3);
}

function drawRight() {
    let projection = rightFrustum(stereoCamera); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );
    if (magRotation) {
      matAccum1 = m4.multiply(matAccum1, magRotation);
    }

    const modelviewInv = m4.inverse(matAccum1, new Float32Array(16));
    const normalMatrix = m4.transpose(modelviewInv, new Float32Array(16));
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertices.length / 3);
}


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    gl.clear(gl.DEPTH_BUFFER_BIT);
    // gl.colorMask(true, false, false, true);
    drawLeft();
    // gl.clear(gl.DEPTH_BUFFER_BIT);
    // gl.colorMask(false, true, true, true);
    // drawRight();
}

function CreateSurfaceData() {
    let vertices = [];
    let texcoords = [];

    const zMax = 1;
    const zScale = 100;
    const zStep = zMax / zScale;
    const uStep = 0.5;

    const calculateUv = (u, z) => {
        return [u / 360, (z + zMax) / (2 * zMax)];
    }

    // Draw vertical lines
    for (let u = 0; u <= 360; u += uStep) {
        for (let z0 = -zMax * zScale; z0 <= zMax * zScale; z0 += zStep * zScale) {
            const z = z0 / zScale;

            const x = (z ** 2) * Math.sqrt(1 - z) * Math.cos(u);
            const y = (z ** 2) * Math.sqrt(1 - z) * Math.sin(u);
            vertices.push(x, y, z);
            texcoords.push(...calculateUv(u, z));

            const z1 = z + zStep;
            const u1 = u + uStep;
            const x1 = (z1 ** 2) * Math.sqrt(1 - z1) * Math.cos(u1);
            const y1 = (z1 ** 2) * Math.sqrt(1 - z1) * Math.sin(u1);
            vertices.push(x1, y1, z);
            texcoords.push(...calculateUv(u + uStep, z + zStep));
        }
    }

    return {vertices, uvs: texcoords};
}

function createSphereData() {
  const radius = 0.15;
  const horizontalPieces = 16;
  const verticalPieces = 16;
  const sphereVertices = [];
  const sphereUvs = [];

  for(let stackNumber = 0; stackNumber <= verticalPieces; stackNumber++) {
    const theta = stackNumber * Math.PI / verticalPieces;
    const nextTheta = (stackNumber + 1) * Math.PI / verticalPieces;

    for(let sliceNumber = 0; sliceNumber <= horizontalPieces; sliceNumber++) {
      const phi = sliceNumber * 2 * Math.PI / horizontalPieces;
      const nextPhi = (sliceNumber + 1) * 2 * Math.PI / horizontalPieces;
      const x1 = radius * Math.sin(theta) * Math.cos(phi);
      const y1 = radius * Math.cos(theta);
      const z1 = radius * Math.sin(theta) * Math.sin(phi);
      const u1 = sliceNumber / horizontalPieces;
      const v1 = stackNumber / verticalPieces;
      const x2 = radius * Math.sin(nextTheta) * Math.cos(nextPhi);
      const y2 = radius * Math.cos(nextTheta);
      const z2 = radius * Math.sin(nextTheta) * Math.sin(nextPhi);
      const u2 = (sliceNumber + 1) / horizontalPieces;
      const v2 = (stackNumber + 1) / verticalPieces;

      const offset = 1.2;
      sphereVertices.push(x1 + offset, y1 + offset, z1);
      sphereVertices.push(x2 + offset, y2 + offset, z2);
      sphereUvs.push(u1, v1);
      sphereUvs.push(u2, v2);
    }
  }

  return { sphereVertices, sphereUvs };
}

/* Initialize the WebGL context. Called from init() */
function initGL() {
    let prog = createProgram( gl, vertexShaderSource, fragmentShaderSource );

    shProgram = new ShaderProgram('Basic', prog);
    shProgram.Use();

    shProgram.iAttribVertex            = gl.getAttribLocation(prog, "vertex");
    shProgram.iAttribTexcoord          = gl.getAttribLocation(prog, "texcoord");
    shProgram.iModelViewProjectionMatrix = gl.getUniformLocation(prog, "ModelViewProjectionMatrix");
    shProgram.iLightPosition          = gl.getUniformLocation(prog, "lightPosition");
    shProgram.iNormalMatrix           = gl.getUniformLocation(prog, "normalMatrix");
    shProgram.iTexScale               = gl.getUniformLocation(prog, "texScale");
    shProgram.iTexCenter = gl.getUniformLocation(prog, 'texCenter');

    surface = new Model();
    let a = createSphereData();
    let b = CreateSurfaceData();
    sphereVertices = a.sphereVertices;
    sphereUvs = a.sphereUvs;
    vertices = b.vertices;
    uvs = b.uvs;
    surface.BufferData();

    const ap = gl.canvas.width / gl.canvas.height;

    stereoCamera = {
        eyeSeparation: 0.004,
        convergence: 1,
        aspectRatio: ap,
        fov: deg2rad(30),
        near: 0.0001,
        far: 20,
    };

    gl.enable(gl.DEPTH_TEST);
}


/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
    let vsh = gl.createShader( gl.VERTEX_SHADER );
    gl.shaderSource(vsh,vShader);
    gl.compileShader(vsh);
    if ( ! gl.getShaderParameter(vsh, gl.COMPILE_STATUS) ) {
        throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
     }
    let fsh = gl.createShader( gl.FRAGMENT_SHADER );
    gl.shaderSource(fsh, fShader);
    gl.compileShader(fsh);
    if ( ! gl.getShaderParameter(fsh, gl.COMPILE_STATUS) ) {
       throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
    }
    let prog = gl.createProgram();
    gl.attachShader(prog,vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if ( ! gl.getProgramParameter( prog, gl.LINK_STATUS) ) {
       throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
    }
    return prog;
}


/**
 * initialization function that will be called when the page has loaded
 */
function init() {
    let canvas;
    try {
        canvas = document.getElementById("webglcanvas");
        gl = canvas.getContext("webgl");
        if ( ! gl ) {
            throw "Browser does not support WebGL";
        }
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not get a WebGL graphics context.</p>";
        return;
    }
    try {
        initGL();  // initialize the WebGL graphics context
    }
    catch (e) {
        document.getElementById("canvas-holder").innerHTML =
            "<p>Sorry, could not initialize the WebGL graphics context: " + e + "</p>";
        return;
    }

    // const videoElement = document.querySelector('video');
    //
    // navigator.mediaDevices.getUserMedia({ video: true })
    //     .then(stream => {
    //         videoElement.srcObject = stream;
    //         videoElement.play();
    //     })
    //     .catch(error => {
    //         console.error('Error accessing user media', error);
    //     });

    spaceball = new TrackballRotator(canvas, draw, 0);

    const xInput = document.getElementById("x");
    const yInput = document.getElementById("y");
    const zInput = document.getElementById("z");
    const scaleUInput = document.getElementById("scaleU");
    const scaleVInput = document.getElementById("scaleV");
    const centerUInput = document.getElementById("centerU");
    const centerVInput = document.getElementById("centerV");
    const eyeSeparationInput = document.getElementById("eyeSeparation");
    const convergenceInput = document.getElementById("convergence");
    const fovInput = document.getElementById("fov");
    const nearInput = document.getElementById("near");


    const updateLight = () => {
        const x = parseFloat(xInput.value);
        const y = parseFloat(yInput.value);
        const z = parseFloat(zInput.value);

        gl.uniform3fv(shProgram.iLightPosition, [x, y, z]);
        draw();
    };

    gl.uniform2fv(shProgram.iTexScale, [1, 1]);
    gl.uniform2fv(shProgram.iTexCenter, [0, 0]);
    const reScale = () => {
        const scaleU = parseFloat(scaleUInput.value);
        const scaleV = parseFloat(scaleVInput.value);
        gl.uniform2fv(shProgram.iTexScale, [scaleU, scaleV]);
        draw();
    };
    const center = () => {
        const centerU = parseFloat(centerUInput.value);
        const centerV = parseFloat(centerVInput.value);
        gl.uniform2fv(shProgram.iTexCenter, [centerU, centerV]);
        draw();
    };
    const stereoCam = () => {
        stereoCamera.eyeSeparation = parseFloat(eyeSeparationInput.value);
        stereoCamera.convergence = parseFloat(convergenceInput.value);
        stereoCamera.fov = deg2rad(parseFloat(fovInput.value));
        stereoCamera.near = parseFloat(nearInput.value);
        draw();
    }

    xInput.addEventListener("input", updateLight);
    yInput.addEventListener("input", updateLight);
    zInput.addEventListener("input", updateLight);
    scaleUInput.addEventListener("input", reScale);
    scaleVInput.addEventListener("input", reScale);
    centerUInput.addEventListener("input", center);
    centerVInput.addEventListener("input", center);
    eyeSeparationInput.addEventListener("input", stereoCam);
    convergenceInput.addEventListener("input", stereoCam);
    fovInput.addEventListener("input", stereoCam);
    nearInput.addEventListener("input", stereoCam);

    draw();

    const image = new Image();
    image.src = "https://www.the3rdsequence.com/texturedb/download/257/texture/jpg/1024/green+moss-1024x1024.jpg";
    image.crossOrigin = "anonymous";
    image.onload = () => {
        setTexture(gl, image);
        draw();
    }

    if ("Magnetometer" in window) {
      const magSensor = new Magnetometer({ frequency: 60 });
      magSensor.addEventListener("reading", () => {
        const rotationX = Math.atan2(magSensor.y, magSensor.z);
        const rotationY = Math.atan2(magSensor.x, magSensor.z);
        const rotationZ = Math.atan2(magSensor.y, magSensor.x);
        const mX = m4.xRotation(rotationX);
        const mY = m4.yRotation(rotationY);
        const mZ = m4.zRotation(rotationZ);
        const acc = m4.multiply(mX, mY);
        magRotation = m4.multiply(acc, mZ);

        draw();
      });
      magSensor.start();

    }
}

function setTexture(gl, image) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}
