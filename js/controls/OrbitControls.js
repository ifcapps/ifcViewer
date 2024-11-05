// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move

THREE.OrbitControls = function ( camera, domElement, scene ) {

	if ( domElement === undefined ) console.warn( 'THREE.OrbitControls: The second parameter "domElement" is now mandatory.' );
	if ( domElement === document ) console.error( 'THREE.OrbitControls: "document" should not be used as the target "domElement". Please use "renderer.domElement" instead.' );

	this.camera = camera;
	this.domElement = domElement;
	this.scene = scene;

	// attributes to enable rotation around arbitrary point
	var m_eye = camera.position;
	var m_lookat = new THREE.Vector3(0,0,0);
	var m_rotate_center = new THREE.Vector3(0,0,0);
	this.setRotateCenter = function( rc ) { m_rotate_center = rc; };
	
	var m_delta_angle_x = 0;
	var m_delta_angle_y = 0;

	var m_eye_pan_start = new THREE.Vector2();
	var m_lookat_pan_start = new THREE.Vector2();
	var m_pan_start = new THREE.Vector3();
	var m_pan_plane = { position: new THREE.Vector3(), normal: new THREE.Vector3() };

	
	function intersectRayPlane( raycaster, plane ){
		var intersect_plane_point = new THREE.Vector3();
		var denom = plane.normal.dot(raycaster.ray.direction);
		if (Math.abs(denom) > 0.0001) // your favorite epsilon
		{
			var t = (plane.position.clone().sub( raycaster.ray.origin )).dot(plane.normal) / denom;
			intersect_plane_point = raycaster.ray.origin.clone().add(  raycaster.ray.direction.clone().multiplyScalar(t) );
			return { intersects:true, intersect_point : intersect_plane_point };
		}
		return { intersects:false, intersect_plane_point };
	}

	var m_pan_raycaster = new THREE.Raycaster();


	// Set to false to disable this control
	this.enabled = true;

	// "target" sets the location of focus, where the camera orbits around
	this.target = new THREE.Vector3();

	// How far you can dolly in and out ( PerspectiveCamera only )
	this.minDistance = 0;
	this.maxDistance = Infinity;

	// How far you can zoom in and out ( OrthographicCamera only )
	this.minZoom = 0;
	this.maxZoom = Infinity;

	// Set to true to enable damping (inertia)
	// If damping is enabled, you must call controls.update() in your animation loop
	this.enableDamping = false;
	this.dampingFactor = 0.05;

	// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
	// Set to false to disable zooming
	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	// Set to false to disable rotating
	this.enableRotate = true;
	this.rotateSpeed = 1.0;

	// Set to false to disable panning
	this.enablePan = true;
	this.panSpeed = 1.0;
	this.screenSpacePanning = true; // if false, pan orthogonal to world-space direction camera.up
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// Set to true to automatically rotate around the target
	// If auto-rotate is enabled, you must call controls.update() in your animation loop
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per orbit when fps is 60

	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Mouse buttons
	this.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };

	// Touch fingers
	this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

	// for reset
	this.target0 = this.target.clone();
	this.position0 = this.camera.position.clone();
	this.zoom0 = this.camera.zoom;

	// the target DOM element for key events
	this._domElementKeyEvents = null;

	var m_line1 = new THREE.Line( new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0) ] ), new THREE.LineBasicMaterial({color: 0x770000}) );
	scene.add( m_line1 );
	var m_line2 = new THREE.Line( new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0) ] ), new THREE.LineBasicMaterial({color: 0x007700}) );
	scene.add( m_line2 );
	var m_line3 = new THREE.Line( new THREE.BufferGeometry().setFromPoints( [ new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0) ] ), new THREE.LineBasicMaterial({color: 0x000077}) );
	scene.add( m_line3 );
	m_line1.visible = false;
	m_line2.visible = false;
	m_line3.visible = false;
	const m_debug = false;
	const geometry = new THREE.SphereGeometry( 0.05, 32, 32 );
	const m_sphere = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( {color: 0xffff00, opacity: 0.5, transparent: true} ) );
	m_sphere.visible = false;
	scene.add( m_sphere );

	//
	// public methods
	this.rotateCamera = function()
	{
		var dx = m_delta_angle_x*1.5;
		var dy = m_delta_angle_y*1.0;
		
		if( dx != 0.0 || dy != 0 )
		{
			// yaw (vertical)
			var yaw_axis = scope.camera.up.clone();
			yaw_axis.normalize();
	
			var center_eye = m_eye.clone().sub( m_rotate_center );
			// lookat is the center of the screen. rotation center can be different (intersection point)
			var center_lookat = m_lookat.clone().sub( m_rotate_center );
			
			// pitch (horizontal, in screen)
			var pitch_axis = yaw_axis.clone().cross( center_eye.clone().normalize() );
			pitch_axis.normalize();
			
			var yaw_axis_corrected = pitch_axis.clone().cross( center_eye.clone().normalize() );
			yaw_axis_corrected.normalize();

			if( m_debug){
				m_line1.geometry.attributes.position.array[0] = m_rotate_center.x;
				m_line1.geometry.attributes.position.array[1] = m_rotate_center.y;
				m_line1.geometry.attributes.position.array[2] = m_rotate_center.z;
				m_line1.geometry.attributes.position.array[3] = m_rotate_center.x + pitch_axis.x;
				m_line1.geometry.attributes.position.array[4] = m_rotate_center.y + pitch_axis.y;
				m_line1.geometry.attributes.position.array[5] = m_rotate_center.z + pitch_axis.z;
				m_line1.geometry.attributes.position.needsUpdate = true;

				m_line2.geometry.attributes.position.array[0] = m_rotate_center.x;
				m_line2.geometry.attributes.position.array[1] = m_rotate_center.y;
				m_line2.geometry.attributes.position.array[2] = m_rotate_center.z;
				m_line2.geometry.attributes.position.array[3] = m_rotate_center.x - yaw_axis_corrected.x;
				m_line2.geometry.attributes.position.array[4] = m_rotate_center.y - yaw_axis_corrected.y;
				m_line2.geometry.attributes.position.array[5] = m_rotate_center.z - yaw_axis_corrected.z;
				m_line2.geometry.attributes.position.needsUpdate = true;
				m_line1.visible = true;
				m_line2.visible = true;
			}
			m_sphere.position.copy(m_rotate_center);
			m_sphere.visible = true;
			//$("#debug").html("line visible");

			center_eye.applyAxisAngle( pitch_axis, dy );
			center_eye.applyAxisAngle( yaw_axis_corrected, -dx );
			if( center_lookat.lengthSq() > 0.1 )
			{
				center_lookat.applyAxisAngle( pitch_axis, dy );
				center_lookat.applyAxisAngle( yaw_axis_corrected, -dx );
			}

			m_eye.copy( m_rotate_center.clone().add(center_eye) );
			m_lookat.copy( m_rotate_center.clone().add(center_lookat) );
			
			// TODO: fix rotation center vertical movemement (relative to screen)
		}
		
		m_delta_angle_x = 0;
		m_delta_angle_y = 0;
	};
	
	this.updateCamera = function()
	{
		scope.rotateCamera( scope.camera );
		scope.camera.position.copy( m_eye );
		scope.camera.lookAt( m_lookat );
		scope.camera.updateProjectionMatrix();
	};

	this.listenToKeyEvents = function ( domElement ) {

		domElement.addEventListener( 'keydown', onKeyDown );
		this._domElementKeyEvents = domElement;

	};

	this.saveState = function () {
		scope.target0.copy( scope.target );
		scope.position0.copy( scope.camera.position );
		scope.zoom0 = scope.camera.zoom;
	};

	this.reset = function () {
		scope.target.copy( scope.target0 );
		scope.camera.position.copy( scope.position0 );
		scope.camera.zoom = scope.zoom0;
		scope.camera.updateProjectionMatrix();
		scope.dispatchEvent( changeEvent );
		scope.update();
		m_state = STATE.NONE;
	};

	this.zoomToBounds = function(bounds, offsetToLeft = false)
	{
		const size = bounds.getSize( new THREE.Vector3() );
		const center = bounds.getCenter( new THREE.Vector3() );
		const maxSize = Math.max( size.x, size.y, size.z );
		const fitHeightDistance = maxSize / ( 2 * Math.atan( Math.PI * scope.camera.fov / 360 ) );
		const fitWidthDistance = fitHeightDistance / scope.camera.aspect;
		const distance = Math.max( fitHeightDistance, fitWidthDistance );
		m_lookat.copy(center);
		var lookat_eye = m_eye.clone().sub( m_lookat );
		lookat_eye.normalize();
		m_eye = m_lookat.clone().add( lookat_eye.multiplyScalar(distance*0.9) );
		scope.camera.position.copy( m_eye );
		scope.camera.lookAt( m_lookat );
		scope.camera.updateProjectionMatrix();
		
		if( offsetToLeft ){
			var event = { clientX : 0.5*this.domElement.clientWidth, clientY: 0.5*this.domElement.clientHeight};
			handleMouseDownPan( event );
			var event2 = { clientX : 0.44*this.domElement.clientWidth, clientY: 0.5*this.domElement.clientHeight};
			handleMouseMovePan( event2 );
			handleMouseUp();
		}
	};
	this.zoomToBoundsInitialAbove = function(bounds, offsetToLeft = false)
	{
		// when loading a model, position the camera above the bounding box (orientation of camera is not kept like in zoomToBounds)
		var center = bounds.getCenter( new THREE.Vector3() );
		var dx = bounds.max.x - bounds.min.x;
		var dy = bounds.max.y - bounds.min.y;
		var dz = bounds.max.z - bounds.min.z;
		var maxDelta = bounds.max.clone().sub(bounds.min).length();
		scope.camera.far = maxDelta*10;
		//m_eye.copy(bounds.max.clone().multiplyScalar(1.8));
		m_eye.set( center.x + maxDelta*0.75, center.y + maxDelta*0.75, center.z + maxDelta*0.3 );
		if( dz < dx*0.1 && dz < dy*0.1 ){
			m_eye.set( center.x + dx*1.0, center.y + dy*1.0, center.z + maxDelta );
		}
		else if( dy < dx*0.2 ){
			m_eye.set( center.x + dx*0.5, center.y + maxDelta, center.z + dz*0.9 );
		}
		else if( dx < dy*0.2 ){
			m_eye.set( center.x + maxDelta, center.y + dy*0.5, center.z + dz*0.9 );
		}
		m_lookat.copy(center);
		m_rotate_center.copy(center);
		scope.camera.position.copy( m_eye );
		scope.camera.lookAt( m_lookat );
		scope.camera.updateProjectionMatrix();

		if( offsetToLeft ){
			var event = { clientX : 0.5*this.domElement.clientWidth, clientY: 0.5*this.domElement.clientHeight};
			handleMouseDownPan( event );
			pan( -0.14*this.domElement.clientWidth, 0 );
			handleMouseUp();
		}
	};

	// this method is exposed, but perhaps it would be better if we can make it private...
	this.update = function () {

		// so camera.up is the orbit axis
		var lastPosition = new THREE.Vector3();
		var lastQuaternion = new THREE.Quaternion();

		return function update() {
			if ( scope.autoRotate && m_state === STATE.NONE ) {
				rotateLeft( getAutoRotationAngle() );
			}

			scope.updateCamera();
			m_zoom_scale = 1;

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				lastPosition.distanceToSquared( scope.camera.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.camera.quaternion ) ) > EPS ) {

				scope.dispatchEvent( changeEvent );
				lastPosition.copy( scope.camera.position );
				lastQuaternion.copy( scope.camera.quaternion );
				zoomChanged = false;

				return true;
			}
			return false;
		};
	}();

	this.dispose = function () {
		scope.domElement.removeEventListener( 'contextmenu', onContextMenu );
		scope.domElement.removeEventListener( 'pointerdown', onPointerDown );
		scope.domElement.removeEventListener( 'wheel', onMouseWheel );
		scope.domElement.removeEventListener( 'touchstart', onTouchStart );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd );
		scope.domElement.removeEventListener( 'touchmove', onTouchMove );
		scope.domElement.ownerDocument.removeEventListener( 'pointermove', onPointerMove );
		scope.domElement.ownerDocument.removeEventListener( 'pointerup', onPointerUp );

		if ( scope._domElementKeyEvents !== null ) {
			scope._domElementKeyEvents.removeEventListener( 'keydown', onKeyDown );
		}
		//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
	};

	//
	// internals
	//
	var scope = this;
	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var STATE = {
		NONE: - 1,
		ROTATE: 0,
		DOLLY: 1,
		PAN: 2,
		TOUCH_ROTATE: 3,
		TOUCH_PAN: 4,
		TOUCH_DOLLY_PAN: 5,
		TOUCH_DOLLY_ROTATE: 6
	};

	var m_state = STATE.NONE;
	var EPS = 0.000001;
	var m_zoom_scale = 1;
	var zoomChanged = false;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	function getAutoRotationAngle() {
		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
	}

	function getZoomScale() {
		return Math.pow( 0.95, scope.zoomSpeed );
	}

	function rotateLeft( angle ) {
		m_delta_angle_x -= angle;
	}

	function rotateUp( angle ) {
		m_delta_angle_y -= angle;
	}

	function getMouseNormalized(x, y ){
		var x1 = x - $(scope.domElement).offset().left;
		var y1 = y - $(scope.domElement).offset().top;
		const w = scope.domElement.clientWidth;
		const h = scope.domElement.clientHeight;
		return new THREE.Vector2((x1 / w ) * 2 - 1, - ( y1 / h ) * 2 + 1);
	}

	// deltaX and deltaY are in pixels; right and down are positive
	var pan = function () {

		return function pan( deltaXscreen, deltaYscreen ) {

			var x = panStart.x + deltaXscreen;
			var y = panStart.y + deltaYscreen;

			var mouse = getMouseNormalized(x,y);
			m_pan_raycaster.setFromCamera( mouse, scope.camera );
			
			var intersect_result = intersectRayPlane( m_pan_raycaster, m_pan_plane );
			if( intersect_result.intersects )
			{
				var diff = intersect_result.intersect_point.sub( m_pan_start );
				if( diff.lengthSq() > 0 )
				{
					m_eye.copy( m_eye_pan_start.clone().sub(diff) );
					m_lookat.copy( m_lookat_pan_start.clone().sub(diff) );
				}
			}

			if ( scope.camera.isPerspectiveCamera ) {


			} else if ( scope.camera.isOrthographicCamera ) {
				// orthographic
				

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				scope.enablePan = false;
			}
		};
	}();

	function dollyOut( dollyScale ) {

		if ( scope.camera.isPerspectiveCamera ) {
			var center_eye_distance = m_eye.clone().sub( m_rotate_center ).length();
			var distance_factor = center_eye_distance*0.25;
			if( distance_factor < 1.5 ) distance_factor = 1.5;
			var zoom_direction = m_pan_raycaster.ray.direction.clone().setLength( -(dollyScale)*distance_factor );
			m_eye.add( zoom_direction );
			m_lookat.add( zoom_direction );
		} else if ( scope.camera.isOrthographicCamera ) {
			scope.camera.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.camera.zoom * dollyScale ) );
			scope.camera.updateProjectionMatrix();
			zoomChanged = true;
		} else {
			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;
		}
	}

	function dollyIn( dollyScale ) {

		if ( scope.camera.isPerspectiveCamera ) {

			var center_eye_distance = m_eye.clone().sub( m_rotate_center ).length();
			var distance_factor = center_eye_distance*3;
			if( distance_factor < 1.5 ) distance_factor = 1.5;
			var zoom_direction = m_pan_raycaster.ray.direction.clone().setLength( (1.0-dollyScale)*distance_factor );
			m_eye.add( zoom_direction );
			m_lookat.add( zoom_direction );
			//$('#statusbar2').html("dollyIn=(" + zoom_direction.x.toFixed(2) + "/" + zoom_direction.y.toFixed(2) + "/" + zoom_direction.z.toFixed(2) + ")  " );

		} else if ( scope.camera.isOrthographicCamera ) {
			scope.camera.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.camera.zoom / dollyScale ) );
			scope.camera.updateProjectionMatrix();
			zoomChanged = true;
		} else {
			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;
		}
	}

	function updateRayCaster(event){
		scope.camera.updateProjectionMatrix();
		var mouse = getMouseNormalized(event.clientX,event.clientY);

		m_pan_raycaster.setFromCamera( mouse, scope.camera );
	}

	//
	// event callbacks - update the camera state
	//
	function handleMouseDownRotate( event ) {
        updateRayCaster(event);
        //m_mainViewer.raycaster.intersectObject( m_mainViewer.rootNode, true, m_vec_intersections );
		var intersects = m_pan_raycaster.intersectObjects( [scope.scene] );
		if( intersects.length > 0 )
		{
			var intersect_point = intersects[0].point;
			m_pan_plane.position.copy(intersect_point);
			setRotateCenter( intersect_point);
		}
		rotateStart.set( event.clientX, event.clientY );
	}

	function handleMouseDownDolly( event ) {
		dollyStart.set( event.clientX, event.clientY );
	}

	function handleMouseDownPan( event ) {
		panStart.set( event.clientX, event.clientY );
		
		scope.domElement.style.cursor = "grab";
		updateRayCaster(event);

		var intersects = m_pan_raycaster.intersectObjects( scope.scene.children, true );
		if( intersects.length > 0 )
		{
			m_pan_start = intersects[0].point;
			m_eye_pan_start = m_eye;
			m_lookat_pan_start = m_lookat;
			m_pan_plane.position.copy( intersects[0].point );
			m_pan_plane.normal.copy( m_pan_raycaster.ray.direction );

			//$('#statusbar2').html("pan start =(" + m_pan_start.x.toFixed(2) + "/" + m_pan_start.y.toFixed(2) + "/" + m_pan_start.z.toFixed(2) + ")  " );
		}
		else{
			m_pan_plane.position.copy( m_rotate_center );
			m_pan_plane.normal.copy( m_eye.clone().sub(m_lookat) );

			var intersect_result = intersectRayPlane( m_pan_raycaster, m_pan_plane );
			if( intersect_result.intersects ){
				m_pan_start = intersect_result.intersect_point;
				m_eye_pan_start = m_eye;
				m_lookat_pan_start = m_lookat;
			}
		}
	}

	function handleMouseMoveRotate( event ) {
		rotateEnd.set( event.clientX, event.clientY );
		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );
		var element = scope.domElement;

		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height. And rotate speed horizontal is 3 times the vertical speed
		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
		rotateStart.copy( rotateEnd );
		scope.update();
	}

	function handleMouseMoveDolly( event ) {
		dollyEnd.set( event.clientX, event.clientY );
		dollyDelta.subVectors( dollyEnd, dollyStart );
		if ( dollyDelta.y > 0 ) {
			dollyOut( getZoomScale() );
		} else if ( dollyDelta.y < 0 ) {
			dollyIn( getZoomScale() );
		}
		dollyStart.copy( dollyEnd );
		scope.update();
	}

	function handleMouseMovePan( event ) {
		panEnd.set( event.clientX, event.clientY );

		panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );
		pan( panDelta.x, panDelta.y );
		panStart.copy( panEnd );
		scope.update();
	}

	function handleMouseUp( /*event*/ ) {
		// no-op
		scope.domElement.style.cursor = "default";
	}

	function handleMouseWheel( event ) {
		if(m_loading){
			return;
		}
		updateRayCaster(event);
		if ( event.deltaY < 0 ) {
			dollyIn( getZoomScale() );
		} else if ( event.deltaY > 0 ) {
			dollyOut( getZoomScale() );
		}
		scope.update();
	}

	function handleKeyDown( event ) {
		var needsUpdate = false;
		switch ( event.keyCode ) {
			case scope.keys.UP:
				pan( 0, scope.keyPanSpeed );
				needsUpdate = true;
				break;
			case scope.keys.BOTTOM:
				pan( 0, - scope.keyPanSpeed );
				needsUpdate = true;
				break;
			case scope.keys.LEFT:
				pan( scope.keyPanSpeed, 0 );
				needsUpdate = true;
				break;
			case scope.keys.RIGHT:
				pan( - scope.keyPanSpeed, 0 );
				needsUpdate = true;
				break;
		}

		if ( needsUpdate ) {
			// prevent the browser from scrolling on cursor keys
			event.preventDefault();
			scope.update();
		}
	}

	function handleTouchStartRotate( event ) {
		if ( event.touches.length == 1 ) {
			rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
		} else {
			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
		var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
			rotateStart.set( x, y );
		}
	}
	function handleTouchStartPan( event ) {
		if ( event.touches.length == 1 ) {
			panStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
		} else {
			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
		var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
			panStart.set( x, y );
		}
	}
	function handleTouchStartDolly( event ) {
		var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
		var distance = Math.sqrt( dx * dx + dy * dy );
		dollyStart.set( 0, distance );
	}

	function handleTouchStartDollyPan( event ) {
		if ( scope.enableZoom ) handleTouchStartDolly( event );
		if ( scope.enablePan ) handleTouchStartPan( event );
	}

	function handleTouchStartDollyRotate( event ) {
		if ( scope.enableZoom ) handleTouchStartDolly( event );
		if ( scope.enableRotate ) handleTouchStartRotate( event );
	}

	function handleTouchMoveRotate( event ) {
		if ( event.touches.length == 1 ) {
			rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
		} else {
			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
			rotateEnd.set( x, y );
		}

		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );
		var element = scope.domElement;
		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height
		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );
		rotateStart.copy( rotateEnd );
	}

	function handleTouchMovePan( event ) {
		if ( event.touches.length == 1 ) {
			panEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );
		} else {
			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );
			panEnd.set( x, y );
		}

		panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );
		pan( panDelta.x, panDelta.y );
		panStart.copy( panEnd );
	}

	function handleTouchMoveDolly( event ) {
		var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
		var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;
		var distance = Math.sqrt( dx * dx + dy * dy );
		dollyEnd.set( 0, distance );
		dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) );
		dollyOut( dollyDelta.y );
		dollyStart.copy( dollyEnd );
	}

	function handleTouchMoveDollyPan( event ) {
		if ( scope.enableZoom ) handleTouchMoveDolly( event );
		if ( scope.enablePan ) handleTouchMovePan( event );
	}

	function handleTouchMoveDollyRotate( event ) {
		if ( scope.enableZoom ) handleTouchMoveDolly( event );
		if ( scope.enableRotate ) handleTouchMoveRotate( event );
	}

	function handleTouchEnd( event ) {
		// no-op
	}

	//
	// event handlers - FSM: listen for events and reset state
	//

	function onPointerDown( event ) {
		if ( scope.enabled === false ) return;
		switch ( event.pointerType ) {
			case 'mouse':
			case 'pen':
				onMouseDown( event );
				break;

			// TODO touch
		}
	}

	function onPointerMove( event ) {
		if( event.stopFurtherHandling ){
			return;
		}
		
		if ( scope.enabled === false ) return;
		switch ( event.pointerType ) {
			case 'mouse':
			case 'pen':
				onMouseMove( event );
				break;
			// TODO touch
		}
	}

	function onPointerUp( event ) {
		m_line1.visible = false;
		m_line2.visible = false;
		m_sphere.visible = false;
		switch ( event.pointerType ) {
			case 'mouse':
			case 'pen':
				onMouseUp( event );
				break;
			// TODO touch
		}
		//$("#debug").html("line hidden");
	}

	function onMouseDown( event ) {

		// Prevent the browser from scrolling.
		event.preventDefault();

		// Manually set the focus since calling preventDefault above
		// prevents the browser from setting it automatically.

		scope.domElement.focus ? scope.domElement.focus() : window.focus();
		var mouseAction;
		switch ( event.button ) {
			case 0:
				mouseAction = scope.mouseButtons.LEFT;
				break;
			case 1:
				mouseAction = scope.mouseButtons.MIDDLE;
				break;
			case 2:
				mouseAction = scope.mouseButtons.RIGHT;
				break;
			default:
				mouseAction = - 1;
		}

		switch ( mouseAction ) {
			case THREE.MOUSE.DOLLY:
				if ( scope.enableZoom === false ) return;
				handleMouseDownDolly( event );
				m_state = STATE.DOLLY;
				break;
			case THREE.MOUSE.ROTATE:
				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
					if ( scope.enablePan === false ) return;
					handleMouseDownPan( event );
					m_state = STATE.PAN;
				} else {
					if ( scope.enableRotate === false ) return;
					handleMouseDownRotate( event );
					m_state = STATE.ROTATE;
				}
				break;

			case THREE.MOUSE.PAN:
				if ( event.ctrlKey || event.metaKey || event.shiftKey ) {
					if ( scope.enableRotate === false ) return;
					handleMouseDownRotate( event );
					m_state = STATE.ROTATE;
				} else {
					if ( scope.enablePan === false ) return;
					handleMouseDownPan( event );
					m_state = STATE.PAN;
				}
				break;

			default:
				m_state = STATE.NONE;
		}

		if ( m_state !== STATE.NONE ) {
			scope.domElement.ownerDocument.addEventListener( 'pointermove', onPointerMove );
			scope.domElement.ownerDocument.addEventListener( 'pointerup', onPointerUp );
			scope.dispatchEvent( startEvent );
		}
	}

	function onMouseMove( event ) {

		//m_pan_plane.position.copy( m_rotate_center );
		//m_pan_plane.lookAt( m_eye );
		//m_pan_plane.updateMatrix();
		//m_pan_plane.geometry.setDrawRange( 0, 4 );
		//m_pan_plane.geometry.computeBoundingBox();
		//m_pan_plane.geometry.attributes.position.needsUpdate = true;

		
		if ( scope.enabled === false ) return;
		event.preventDefault();
		switch ( m_state ) {
			case STATE.ROTATE:
				if ( scope.enableRotate === false ) return;
				handleMouseMoveRotate( event );
				break;

			case STATE.DOLLY:
				if ( scope.enableZoom === false ) return;
				handleMouseMoveDolly( event );
				break;

			case STATE.PAN:
				if ( scope.enablePan === false ) return;
				handleMouseMovePan( event );
				break;
		}
	}

	function onMouseUp( event ) {
		scope.domElement.ownerDocument.removeEventListener( 'pointermove', onPointerMove );
		scope.domElement.ownerDocument.removeEventListener( 'pointerup', onPointerUp );
		if ( scope.enabled === false ) return;
		handleMouseUp( event );
		scope.dispatchEvent( endEvent );
		m_state = STATE.NONE;
	}

	function onMouseWheel( event ) {
		if ( scope.enabled === false || scope.enableZoom === false || ( m_state !== STATE.NONE && m_state !== STATE.ROTATE ) ) return;
		event.preventDefault();
		event.stopPropagation();
		scope.dispatchEvent( startEvent );
		handleMouseWheel( event );
		scope.dispatchEvent( endEvent );
	}

	function onKeyDown( event ) {
		if ( scope.enabled === false || scope.enablePan === false ) return;
		handleKeyDown( event );
	}

	function onTouchStart( event ) {
		if ( scope.enabled === false ) return;
		event.preventDefault(); // prevent scrolling
		switch ( event.touches.length ) {
			case 1:
				switch ( scope.touches.ONE ) {
					case THREE.TOUCH.ROTATE:
						if ( scope.enableRotate === false ) return;
						handleTouchStartRotate( event );
						m_state = STATE.TOUCH_ROTATE;
						break;
					case THREE.TOUCH.PAN:
						if ( scope.enablePan === false ) return;
						handleTouchStartPan( event );
						m_state = STATE.TOUCH_PAN;
						break;

					default:
						m_state = STATE.NONE;
				}
				break;

			case 2:
				switch ( scope.touches.TWO ) {
					case THREE.TOUCH.DOLLY_PAN:
						if ( scope.enableZoom === false && scope.enablePan === false ) return;
						handleTouchStartDollyPan( event );
						m_state = STATE.TOUCH_DOLLY_PAN;
						break;

					case THREE.TOUCH.DOLLY_ROTATE:
						if ( scope.enableZoom === false && scope.enableRotate === false ) return;
						handleTouchStartDollyRotate( event );
						m_state = STATE.TOUCH_DOLLY_ROTATE;
						break;

					default:
						m_state = STATE.NONE;
				}
				break;

			default:
				m_state = STATE.NONE;
		}

		if ( m_state !== STATE.NONE ) {
			scope.dispatchEvent( startEvent );
		}
	}

	function onTouchMove( event ) {
		if ( scope.enabled === false ) return;

		event.preventDefault(); // prevent scrolling
		event.stopPropagation();

		switch ( m_state ) {
			case STATE.TOUCH_ROTATE:
				if ( scope.enableRotate === false ) return;
				handleTouchMoveRotate( event );
				scope.update();
				break;

			case STATE.TOUCH_PAN:
				if ( scope.enablePan === false ) return;
				handleTouchMovePan( event );
				scope.update();
				break;

			case STATE.TOUCH_DOLLY_PAN:
				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				handleTouchMoveDollyPan( event );
				scope.update();
				break;

			case STATE.TOUCH_DOLLY_ROTATE:
				if ( scope.enableZoom === false && scope.enableRotate === false ) return;
				handleTouchMoveDollyRotate( event );
				scope.update();
				break;

			default:
				m_state = STATE.NONE;
		}
	}

	function onTouchEnd( event ) {
		if ( scope.enabled === false ) return;
		handleTouchEnd( event );
		scope.dispatchEvent( endEvent );
		m_state = STATE.NONE;
	}

	function onContextMenu( event ) {
		if ( scope.enabled === false ) return;
		event.preventDefault();

	}

	scope.domElement.addEventListener( 'contextmenu', onContextMenu );
	scope.domElement.addEventListener( 'pointerdown', onPointerDown );
	scope.domElement.addEventListener( 'wheel', onMouseWheel );
	scope.domElement.addEventListener( 'touchstart', onTouchStart );
	scope.domElement.addEventListener( 'touchend', onTouchEnd );
	scope.domElement.addEventListener( 'touchmove', onTouchMove );

	// force an update at start
	this.update();
};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
// This is very similar to OrbitControls, another set of touch behavior
//
//    Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - left mouse, or arrow keys / touch: one-finger move

THREE.MapControls = function ( object, domElement ) {

	THREE.OrbitControls.call( this, object, domElement );

	this.screenSpacePanning = false; // pan orthogonal to world-space direction camera.up

	this.mouseButtons.LEFT = THREE.MOUSE.PAN;
	this.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

	this.touches.ONE = THREE.TOUCH.PAN;
	this.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

};

THREE.MapControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.MapControls.prototype.constructor = THREE.MapControls;
