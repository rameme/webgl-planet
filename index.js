"use strict";

var canvas;
var gl;

var numTimesToSubdivide = 64;

var index = 0;

var texSize = 64;
var program;

/* texture, points, and noramls */
var pointsArray = [];
var normalsArray = [];
var texCoordsArray = [];
var indicesArray = [];

var texture;
var texturePlanet;
var textureAtmosphere;

var hasAtmosphere = 0;
var texturePlanetLocation;
var textureAtmosphereLocation;

/* rotation */
var rotateClockwise = 0;
var rotateCounterClockwise = 0;
var rotateAngle = 0;
var roateSide = 0;

/* camera */
var near = -10;
var far = 10;
var radius = 1.5;
var theta  = 0.0;
var phi    = 0.0;
var dr = 5.0 * Math.PI/180.0;

var left = -3.0;
var right = 3.0;
var ytop =3.0;
var bottom = -3.0;

/* lighting */
var lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
var lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
var lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

var materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
var materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
var materialShininess = 100.0;

var ctm;
var ambientColor, diffuseColor, specularColor;
var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var normalMatrix, normalMatrixLoc;

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

/* content */
const PI = Math.PI
const TWOPI = 2 * Math.PI
const r = 3

// ConfigureTexture 
function configureTexture( image, index ) {
    texture = gl.createTexture();
    if (index == 0){
        // earth
        gl.activeTexture(gl.TEXTURE0);
    } else {
        // cloud
        gl.activeTexture(gl.TEXTURE1);
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
        gl.uniform1i(gl.getUniformLocation(program, "texturePlanet"), 0);
        texturePlanet = texture
    } else {
        // atmosphere
        gl.uniform1i(gl.getUniformLocation(program, "textureAtmosphere"), 0);
        textureAtmosphere = texture
    }
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

    texturePlanetLocation = gl.getUniformLocation(program, "texturePlanet");
    textureAtmosphereLocation = gl.getUniformLocation(program, "textureAtmosphere");

    // earth texture 
    rotateClockwise = 0;
    rotateCounterClockwise = 1;
    roateSide = 0;
    var image = new Image();
    image.onload = function() {
        configureTexture( image, 0 );
    }
    image.src = "assets/8k_earth_daymap.jpg"

    // earth texture clouds
    var imageAtmosphere = new Image();
    imageAtmosphere.onload = function() {
        configureTexture( imageAtmosphere, 1 );
    }
    imageAtmosphere.src = "assets/8k_earth_clouds.jpg"

    selectObjectListener();

    setLighting()

    render();
}

function setLighting() {
    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);

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
}


// Rotate by y axis
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

// Rotate by x axis
function rotateSide(angle) {
    var a = Math.cos(angle);
    var b = Math.sin(angle);

    var result = mat4()
    result[1][1] = a
    result[1][2] = b
    result[2][1] = -b
    result[2][2] = a

    return result
}

// Render planet
function renderPlanet(){
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

    // Roate planet
    if (rotateClockwise == 1){
        if (roateSide == 0){
            gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(mult(modelViewMatrix, rotate(rotateAngle += 0.009)) ) );
        } else {
            gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(mult(modelViewMatrix, rotateSide(rotateAngle += 0.009)) ) );
        }
    } else if (rotateCounterClockwise == 1) {
        gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(mult(modelViewMatrix, rotate(rotateAngle -= 0.009)) ) );
    } else {
        gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix) );
    }
    
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix) );
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMatrix) );

    // set which texture units to render with
    gl.uniform1i(texturePlanetLocation, 0);  // texture unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texturePlanet);

    gl.uniform1i(textureAtmosphereLocation, 1);  // texture unit 1
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, textureAtmosphere);

    gl.drawElements(gl.TRIANGLES, indicesArray.length, gl.UNSIGNED_SHORT, 0);
}

// render
function render() {
    gl.clear( gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderPlanet()
    window.requestAnimFrame(render);
}

// change texture for planet
/* 
    Delete old texture
    Assign roatation 
    Get new texture
    Set lighting
*/
function selectObjectListener() {
    document.getElementById("sun").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/8k_sun.jpg"

        lightPosition = vec4(0.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("mercury").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/8k_mercury.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("venus").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 1;
        rotateCounterClockwise = 0;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/8k_venus_surface.jpg"

        var imageAtmosphere = new Image();
        imageAtmosphere.onload = function() {
            configureTexture( imageAtmosphere, 1 );
        }
        imageAtmosphere.src = "assets/4k_venus_atmosphere.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 0.35, 0.35, 0.35, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("earth").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;
        
        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/8k_earth_daymap.jpg"

        var imageAtmosphere = new Image();
        imageAtmosphere.onload = function() {
            configureTexture( imageAtmosphere, 1 );
        }
        imageAtmosphere.src = "assets/8k_earth_clouds.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("moon").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 1;
        rotateCounterClockwise = 0;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/8k_moon.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("jupiter").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/8k_jupiter.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("saturn").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/8k_saturn.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("uranus").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 1;
        rotateCounterClockwise = 0;
        roateSide = 1;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/2k_uranus.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("neptune").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/2k_neptune.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("ceres").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/4k_ceres_fictional.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("haumea").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/4k_haumea_fictional.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("makemake").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/4k_makemake_fictional.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };

    document.getElementById("eris").onclick = function(){
        gl.deleteTexture(texturePlanet);
        gl.deleteTexture(textureAtmosphere);

        rotateClockwise = 0;
        rotateCounterClockwise = 1;
        roateSide = 0;

        var image = new Image();
        image.onload = function() {
            configureTexture( image, 0 );
        }
        image.src = "assets/4k_eris_fictional.jpg"

        lightPosition = vec4(-10.0, 0.0, 0.0, 0.0 );
        lightAmbient = vec4(1.0, 1.0, 1.0, 1.0 );
        lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );

        materialAmbient = vec4( 0.2, 0.2, 0.2, 1.0 );
        materialDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
        materialSpecular = vec4( 0.0, 0.0, 0.0, 1.0 );
        materialShininess = 100.0;

        setLighting()
    };
}