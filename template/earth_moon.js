"use strict";

var canvas;
var gl;

var numTimesToSubdivide = 32;

var index = 0;

var texSize = 64;
var program;

/* texture, points, and noramls */
var pointsArray = [];
var normalsArray = [];
var texCoordsArray = [];
var indicesArray = [];

var texture;
var textures = [];

var textureLocation;
var textureCloudLocation;

/* roate object */
var rotateAngle = 0;

/* Camera */
var near = -10;
var far = 20;
var radius = 1.5;
var theta  = 0.0;
var phi    = 0.0;
var dr = 5.0 * Math.PI/180.0;

var left = -3.0;
var right = 3.0;
var ytop =3.0;
var bottom = -3.0;

/* Lighting */
var lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
var lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
var lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
var materialDiffuse = vec4( 0.75, 0.75, 0.75, 1.0 );
var materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
var materialShininess = 200.0;

var ctm;
var ambientColor, diffuseColor, specularColor;

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var normalMatrix, normalMatrixLoc;
var instanceMatrix;

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

/* constants */
const PI = Math.PI;
const TWOPI = 2 * Math.PI;
const r = 1.25;

/* multiple objects */
var object = [];

/* init object */
const numObject = 2;
const earthId = 0;
const moonId = 1;
object[0] = createObject(null, null, null);
object[1] = createObject(null, null, null);


// rotate object
function rotate(angle) {
    var a = Math.cos(angle);
    var b = Math.sin(angle);

    var result = mat4()
    result[0][0] = a
    result[0][2] = -b
    result[2][0] = b
    result[2][2] = a

    return result
}

// scale object
function scale4(a, b, c) {
    var result = mat4();
    result[0][0] = a;
    result[1][1] = b;
    result[2][2] = c;
    return result;
}

// ConfigureTexture 
function configureTexture( image, index ) {
    texture = gl.createTexture();
    if (index == 0){
        // earth
        gl.activeTexture(gl.TEXTURE0);
    } else if (index == 1) {
        // cloud
        gl.activeTexture(gl.TEXTURE1);
    } else if (index == 2) {
        // moon
        gl.activeTexture(gl.TEXTURE2);
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGB,
         gl.RGB, gl.UNSIGNED_BYTE, image );

    // Not a Power of 2 image
    // Turn off mipmap and set warpping to clamp to edge 
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (index == 0){
        // earth
        gl.uniform1i(textureLocation, 0);
    } else if (index == 1) {
        // cloud
        gl.uniform1i(textureCloudLocation, 0);
    } else if (index == 2) {
        // mooon
        gl.uniform1i(textureLocation, 0);
    }

    // add the texture to the array of textures.
    textures.push(texture);
}

// generate sphere
function generateSphere() {

    // note: s = u, t = v
    var stepSize = 1/numTimesToSubdivide

    for (var u = 0; u <= 1; u+= stepSize){
        for (var v = 0; v <= 1; v+= stepSize){
            
            // points
            var px = -r * Math.sin(PI * u) * Math.cos(TWOPI * v)
            var py = -r * Math.cos(PI * u)
            var pz = r * Math.sin(PI * u) * Math.sin(TWOPI * v)
            pointsArray.push( vec4(px, py, pz, 1.0) )

            /* Normals */
            // normalize (position - center)
            var normal = normalize(subtract( vec4(px , py, pz, 1.0), vec4(0.0, 0.0, 0.0, 1.0) ) )
            normalsArray.push( vec4(normal) );

            // texcords 
            texCoordsArray.push( vec2(v, u) )
        }
    }


    for (var u = 0; u < numTimesToSubdivide; u++){
        for (var v = 0; v < numTimesToSubdivide; v++){

            // indices 
            // 2 triangles per quad
            var k1 = u * (numTimesToSubdivide + 1) + v
            var k2 = k1 + (numTimesToSubdivide + 1)

            // k1 -> k2 -> k1 + 1
            indicesArray.push(k1)
            indicesArray.push(k2)
            indicesArray.push(k1 + 1)

            // k1+1 ⟶ k2 ⟶ k2+1
            indicesArray.push(k1 + 1)
            indicesArray.push(k2)
            indicesArray.push(k2 + 1)
        }
    }

}

// create object
function createObject(transform, render, sibling){
    var node = {
        transform: transform,
        render: render,
        sibling: sibling,
    }
    return node;
}

// init object
function initObjects(Id) {
    var m = mat4();

    switch(Id) {
        // earth
        case earthId:
            m = translate(0.0, 0.0, 0.0);
            object[earthId] = createObject( m, earth, moonId );
            break;

        // moon
        case moonId:
            m = translate(0.0, 0.0, 0.0);
            object[moonId] = createObject( m, moon, null );
            break;
    }
}

// render earth
function earth() {
    instanceMatrix = mult(modelViewMatrix, translate(0.0, 0.0, 0.0) );
    instanceMatrix = mult(instanceMatrix, scale4(1.0, 1.0, 1.0) );  
    instanceMatrix = mult(instanceMatrix, rotate(rotateAngle+= 0.009) );
    
    eye = vec3(radius*Math.sin(theta)*Math.cos(phi),
        radius*Math.sin(theta)*Math.sin(phi), radius*Math.cos(theta));

    modelViewMatrix = lookAt(eye, at , up);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);

    // normal matrix only really need if there is nonuniform scaling
    // it's here for generality but since there is
    // no scaling in this example we could just use modelView matrix in shaders
    normalMatrix = [
        vec3(modelViewMatrix[0][0], modelViewMatrix[0][1], modelViewMatrix[0][2]),
        vec3(modelViewMatrix[1][0], modelViewMatrix[1][1], modelViewMatrix[1][2]),
        vec3(modelViewMatrix[2][0], modelViewMatrix[2][1], modelViewMatrix[2][2])
    ];

    // gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(mult(modelViewMatrix, rotate(rotateAngle -= 0.009)) ) );
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix) );
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMatrix) );

      // set which texture units to render with.
    gl.uniform1i(textureLocation, 0);  // texture unit 0
    gl.uniform1i(textureCloudLocation, 1);  // texture unit 1

    // set texture for earth
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, textures[0]);

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, textures[1]);

    gl.drawElements(gl.TRIANGLES, indicesArray.length, gl.UNSIGNED_SHORT, 0);
}

// render moon
function moon() {
    instanceMatrix = mult(modelViewMatrix, translate(-2.5, 0.0, 0.0) );
	instanceMatrix = mult(instanceMatrix, scale4(0.25, 0.25, 0.25) );
    
    eye = vec3(radius*Math.sin(theta)*Math.cos(phi),
        radius*Math.sin(theta)*Math.sin(phi), radius*Math.cos(theta));

    modelViewMatrix = lookAt(eye, at , up);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);

    // normal matrix only really need if there is nonuniform scaling
    // it's here for generality but since there is
    // no scaling in this example we could just use modelView matrix in shaders
    normalMatrix = [
        vec3(modelViewMatrix[0][0], modelViewMatrix[0][1], modelViewMatrix[0][2]),
        vec3(modelViewMatrix[1][0], modelViewMatrix[1][1], modelViewMatrix[1][2]),
        vec3(modelViewMatrix[2][0], modelViewMatrix[2][1], modelViewMatrix[2][2])
    ];

    modelViewMatrix = lookAt(eye, at , up);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(instanceMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix) );
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMatrix) );

    // set texture for moon
    gl.uniform1i(textureLocation, 2);
    gl.uniform1i(textureCloudLocation, 2); 

    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, textures[2]);

    gl.drawElements(gl.TRIANGLES, indicesArray.length, gl.UNSIGNED_SHORT, 0);
}

// render all object
function renderObject(Id) {
    if(Id == null) return;

    object[Id].render();
    
    if(object[Id].sibling != null) {
        renderObject(object[Id].sibling);
    }
 }


window.onload = function init() {

    canvas = document.getElementById( "gl-canvas" );

    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    
    // change color of the canvas background 
    gl.clearColor( 0.0, 0.0, 0.0, 1.0 );

    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    instanceMatrix = mat4();
    modelViewMatrix = mat4();

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);

    generateSphere()

    // index buffer
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indicesArray), gl.STATIC_DRAW);

    // create and link buffer for normals 
    var nBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData( gl.ARRAY_BUFFER, flatten(normalsArray), gl.STATIC_DRAW );

    var vNormal = gl.getAttribLocation( program, "vNormal" );
    gl.vertexAttribPointer( vNormal, 4, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vNormal);

    // create and link buffer for position 
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(pointsArray), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation( program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // create and link buffer for texture 
    var tBuffer = gl.createBuffer();
    gl.bindBuffer( gl.ARRAY_BUFFER, tBuffer );
    gl.bufferData( gl.ARRAY_BUFFER, flatten(texCoordsArray), gl.STATIC_DRAW );

    var vTexCoord = gl.getAttribLocation( program, "vTexCoord" );
    gl.vertexAttribPointer( vTexCoord, 2, gl.FLOAT, false, 0, 0 );
    gl.enableVertexAttribArray( vTexCoord );

    modelViewMatrixLoc = gl.getUniformLocation( program, "modelViewMatrix" );
    projectionMatrixLoc = gl.getUniformLocation( program, "projectionMatrix" );
    normalMatrixLoc = gl.getUniformLocation( program, "normalMatrix" );

    textureLocation = gl.getUniformLocation(program, "texture");
    textureCloudLocation = gl.getUniformLocation(program, "textureCloud");

    // assign textures 
    var imageEarth = document.getElementById("texEarth");
    configureTexture( imageEarth, 0 );

    var imageEarthCloud = document.getElementById("texEarthCloud");
    configureTexture( imageEarthCloud, 1 );

    var imageMoon = document.getElementById("texMoon");
    configureTexture( imageMoon, 2 );

    gl.uniform4fv( gl.getUniformLocation(program,
       "ambientProduct"),flatten(ambientProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
       "diffuseProduct"),flatten(diffuseProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
       "specularProduct"),flatten(specularProduct) );
    gl.uniform4fv( gl.getUniformLocation(program,
       "lightPosition"),flatten(lightPosition) );
    gl.uniform1f( gl.getUniformLocation(program,
       "shininess"),materialShininess );

    for(var i=0; i<numObject; i++) initObjects(i);

    render();
}

function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    theta -= 0.01;
    renderObject(earthId)
    
    window.requestAnimFrame(render);
}