'use strict';

let gl;                         // The webgl context.
let surface;                    // A surface model
let shProgram;                  // A shader program
let spaceball;                  // A SimpleRotator object that lets the user rotate the view by mouse.
let verticalPoints = 0;
let horizontalPoints = 0;

function deg2rad(angle) {
    return angle * Math.PI / 180;
}


// Constructor
function Model(name) {
    this.name = name;
    this.count = 0;
    this.vertices;

    this.BufferData = function(vertices, texcoords) {

        // vertices
        const vBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);
        gl.enableVertexAttribArray(shProgram.iAttribVertex);
        gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);

        // texcoords
        const tBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STREAM_DRAW);
        gl.enableVertexAttribArray(shProgram.iAttribTexcoord);
        gl.vertexAttribPointer(shProgram.iAttribTexcoord, 2, gl.FLOAT, false, 0, 0);

        this.count = vertices.length / 3;
        this.vertices = vertices;
    }

    this.Draw = function() {

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);

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


/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() { 
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    /* Set the values of the projection transformation */
    let projection = m4.perspective(Math.PI/8, 1, 8, 12); 
    
    /* Get the view matrix from the SimpleRotator object.*/
    let modelView = spaceball.getViewMatrix();

    let rotateToPointZero = m4.axisRotation([0.707,0.707,0], 0.7);
    let translateToPointZero = m4.translation(0,0,-10);

    let matAccum0 = m4.multiply(rotateToPointZero, modelView );
    let matAccum1 = m4.multiply(translateToPointZero, matAccum0 );

    const modelviewInv = m4.inverse(matAccum1, new Float32Array(16));
    const normalMatrix = m4.transpose(modelviewInv, new Float32Array(16));
        
    /* Multiply the projection matrix times the modelview matrix to give the
       combined transformation matrix, and send that to the shader program. */
    let modelViewProjection = m4.multiply(projection, matAccum1 );

    gl.uniformMatrix4fv(shProgram.iModelViewProjectionMatrix, false, modelViewProjection );

    gl.uniformMatrix4fv(shProgram.iNormalMatrix, false, normalMatrix);

    surface.Draw();
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

    return {vertices, texcoords};
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

    surface = new Model('Surface');
    const {vertices, texcoords} = CreateSurfaceData();
    surface.BufferData(vertices, texcoords);

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

    spaceball = new TrackballRotator(canvas, draw, 0);

    const xInput = document.getElementById("x");
    const yInput = document.getElementById("y");
    const zInput = document.getElementById("z");

    const updateLight = () => {
        const x = parseFloat(xInput.value);
        const y = parseFloat(yInput.value);
        const z = parseFloat(zInput.value);

        console.log(x, y, z);

        gl.uniform3fv(shProgram.iLightPosition, [x, y, z]);
        draw();
    };

    xInput.addEventListener("input", updateLight);
    yInput.addEventListener("input", updateLight);
    zInput.addEventListener("input", updateLight);

    draw();

    const image = new Image();
    image.src = "https://www.the3rdsequence.com/texturedb/download/257/texture/jpg/1024/green+moss-1024x1024.jpg";
    image.crossOrigin = "anonymous";
    image.onload = () => {
        setTexture(gl, image);
    }
}

function setTexture(gl, image) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}
