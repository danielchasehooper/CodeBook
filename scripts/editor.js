var CODEBOOK, draw, Keys;

/* 
 * Javascript additions
 */ 

if (!console) {
	var console = {log: function(string){"use strict";}};
}

if (typeof Object.create !== 'function') {
	"use strict";
	Object.create = function (o) {
		function F(){}
		F.prototype = o;		
		return new F();
	};
}

/* 
 * API Functions 
 * These are availible to the code being run
 * 
 */ 

draw = function(c){};

Keys = {left:false,down:false,right:false,up:false};

function framerate(fps){"use strict";
	return CODEBOOK.framerate(fps);
}

function color(r,g,b,a) {"use strict";
	return "rgba("+r+","+g+","+b+","+(a || 1)+")";
}

function exists(value) {"use strict";
	return (typeof value !== "undefined" && value !== null);
}

/* 
 * Codebook Core 
 * The interesting stuff
 * 
 */ 

CODEBOOK = (function(){
	"use strict";
	var editor;
	var jslintWorker;
	var errors = [];
	
	var errorLineNumber = -1;
	var errorText = "";
	var isSlidingNumber = false;
	var lastMousePosition = false;
	var lastCursorLine;
	var controlPressed;
	
	// from touch view
	var canvas, context;
	var probeCanvas, probeContext;
	var probeLine;
	
	var probex, probey;
	
	var scriptNode;
	var timeout;
	var initialValues = {};
	var framerateInterval = 17;
	
	var editorHasFocus = false;
	
	var canvasHightlightColor = "#e33";
	
	var hightlightLine, getHighlightLine;
	(function () {
		var line = -1;
		
		hightlightLine = function(newLineNumber) {
			editor.setLineClass(line-1, undefined);
			
			line = newLineNumber;
			
			if (line !== -1) {
				editor.setLineClass(line-1, "highlightLine");
			}
			
			if (!timeout) {
				render(true, false);
			}
		};
		
		getHighlightLine = function() {
			return line;
		};
	}());
	
	
	var setInspectMode, inspectMode;
	(function () {
		var private_inspectorMode = false;
		setInspectMode = function (shouldInspect) {
			private_inspectorMode = shouldInspect;
			
			if (private_inspectorMode) {
				stop();
				document.body.className = "inspectCursor";
				document.getElementById("inspectButton").className = "button buttonPressed";
			} else {
				start();
				hightlightLine(-1);
				document.body.className = undefined;
				document.getElementById("inspectButton").className = "button";
			}
		};
		
		inspectMode = function () {
			return private_inspectorMode;
		};
	}());
	
	var typesToPersistState = {
		number:true,
		boolean:true,
		string:true
	};
/* 	typesToPersistState["function"] = true; */
	
	/* Event Handlers */
	
	function keyDownHandler(e){

		if (!editorHasFocus) {
			switch(e.keyCode) {
				case 37:
					Keys.left = true;
					break;
				case 38:
					Keys.up = true;
					break;
				case 39:
					Keys.right = true;
					break;
				case 40:
					Keys.down = true;
					break;
			}
		}
		
		if (e.keyCode === 91 || e.keyCode === 18) {
			controlPressed = true;
		}
	}
	
	function keyUpHandler(e){
		switch(e.keyCode) {
			case 37:
				Keys.left = false;
				break;
			case 38:
				Keys.up = false;
				break;
			case 39:
				Keys.right = false;
				break;
			case 40:
				Keys.down = false;
				break;
		}
		
		if (e.keyCode === 91 || e.keyCode === 18) {
			controlPressed = false;
		}
	}
	
	function hideErrorPopover(){
		document.getElementById("errorReport").className  = "hideReport";
	}
	
	function lintParsingComplete(e){
		errors = e.data.errors;
		
		// check for errors
		if (!e.data.passed) {
			var i;			
			console.log("setting JSLint line markers");
			for (i = 0; i < errors.length; i+=1) {
				if (errors[i]) {
					editor.setLineClass(errors[i].line,"errorLine");
					editor.setMarker(errors[i].line," ","errorMarker");
				}
			}
		}
		
		if (errorLineNumber >= 0) {
			editor.setLineClass(errorLineNumber,"errorLine");
			editor.setMarker(errorLineNumber," ","errorMarker");
		}
		
		// navigate to first error?
	}
	
	function textChangeHandler(editorArg, info) {
		var i, editorString;
				
		if (jslintWorker) {
			jslintWorker.postMessage({cmd:"STOP"});
			jslintWorker = undefined;
		}
		
		editorString = editor.getValue();
		window.localStorage.code = editorString;

		if (!isSlidingNumber){
			errorLineNumber = -1;
			hideErrorPopover();
			errors = [];
		
		
			// This takes a really long time to do, should look for another way.
			for (i = 0; i < editor.lineCount(); i++) {
				editor.setLineClass(i,undefined);
				editor.clearMarker(i);
			}
		
			console.log("Messaging worker");
			jslintWorker = new Worker('scripts/jsLintWorker.js')
			jslintWorker.addEventListener("message",lintParsingComplete,false);
			jslintWorker.postMessage({cmd:"lint",code:editorString});
		}
		
		// TODO: should liveview only be updated if code is valid? 
		updateCode(editorString);
	}
	
	 function showErrorForLine(line) {
		var errorString = "";
		var i;
		for (i =0; i < errors.length; i++) {
			if (exists(errors[i]) && errors[i].line === line) {
				errorString += errors[i].reason+"\n";
				break;
			}
		}

		if(errorLineNumber === line) {
			errorString = errorText;
		}

		if (errorString.length > 1){
			var el = document.getElementById("errorReport");
			el.innerHTML = errorString;
			el.style.top = editor.charCoords({line:line+1,ch:0}).y +2+ "px";
			el.className = "";
			el.addEventListener('mouseout',function(){
				hideErrorPopover();
			},true);
		}
	}



	/* Events */
	
	function mouseoutHandler(e) {
		hightlightLine(-1);
	}

	function mouseDown(event){
		if (controlPressed) {
			lastMousePosition = {x:event.pageX,y:event.pageY};
			var position = editor.coordsChar(lastMousePosition);
			var content = editor.getTokenAt(position);
			
			if (!isNaN(content.string) && content.className==="number" && !editor.somethingSelected()) {
				isSlidingNumber = content;
				isSlidingNumber.lineNumber = position.line;
				
				// include negative numbers
				var prefix = editor.getTokenAt({line:position.line, ch: content.start});
				if (prefix.string === '-') {
					isSlidingNumber.start-=1;
					isSlidingNumber.string = '-'+isSlidingNumber.string;
				}
				
				event.stopPropagation();
			} else {
				isSlidingNumber = false;
			}
		}
	}

	function mouseMoved(e){
		if (isSlidingNumber) {
			isSlidingNumber.dragged = true;
			
			var newString = String(parseFloat(isSlidingNumber.string)+(e.pageX - lastMousePosition.x));
			
			editor.replaceRange(newString,
			{line:isSlidingNumber.lineNumber, 
				ch:isSlidingNumber.start},
				{line:isSlidingNumber.lineNumber, 
					ch:isSlidingNumber.end});

			isSlidingNumber.string = newString;
			isSlidingNumber.end = isSlidingNumber.start+isSlidingNumber.string.length;
			
			 editor.setSelection({line:isSlidingNumber.lineNumber, 
			 						ch:isSlidingNumber.start},
			 						{line:isSlidingNumber.lineNumber, 
			 							ch:isSlidingNumber.end});
			e.stopPropagation();
		}

		lastMousePosition = {x:e.pageX,y:e.pageY};
		
		if (inspectMode()) {
			if(document.getElementById("TouchCodeMainCanvas") === e.target) {
				var line = getDrawCallLineNumberForScreenLocation(e.offsetX,e.offsetY);
				hightlightLine(line);
				scrollToLine(line-1);
			}
		}
	}

	function mouseUp(event) {
		if (isSlidingNumber) {
			var temp = isSlidingNumber;

			// move cursor to another line to let layout engine do its job
			if (isSlidingNumber.dragged) {
				setTimeout(function (){
						editor.setCursor({line:temp.lineNumber+1,ch:1});
						editor.setCursor({line:temp.lineNumber,ch:temp.end});

						
				},1);
			}
		}
		isSlidingNumber = false;
		
		if (event.target === document.getElementById("inspectButton")) {
			setInspectMode(!inspectMode());
		} else {
			setInspectMode(false);
		}
	}

	/* text events */

	function cursorActivity() {
		if (isSlidingNumber) {
		//	editor.setCursor({line:isSlidingNumber.lineNumber,ch:isSlidingNumber.end});

			editor.setSelection({line:isSlidingNumber.lineNumber, 
									ch:isSlidingNumber.start},
									{line:isSlidingNumber.lineNumber, 
										ch:isSlidingNumber.end});
		} else {
			
			 var currentCursorLine = editor.getCursor().line;
			 if(lastCursorLine !== currentCursorLine) {
			 	showErrorForLine(currentCursorLine);
			 }
			 lastCursorLine = currentCursorLine;
		}
	}

	function gutterClicked(editInstance, line, event) {
		showErrorForLine(line);
	}

	function updateCode(string) {
		stop();
	

		// keep track of new variables by learning old variables
		var firstLevel =  {};
		var propertyName;
		for (propertyName in window) {
			if (window.hasOwnProperty(propertyName) && typesToPersistState[typeof window[propertyName]]) {
				firstLevel[propertyName] = window[propertyName];
			}
		}

		// inject line numbers into source
		var lines = string.split("\n");
		var i;
		
		for (i = 0; i < lines.length; i++) {
			lines[i] = "CODEBOOK.currentOperatingLineNumber="+(i+1)+";"+lines[i];
		}
		string = '"use strict"; ' +lines.join("\n");

		// create node
		var sourceHolderEl = document.getElementById("sourceHolder");         
		var newScript = document.createElement('script');
		newScript.type = 'text/javascript';

		var sourceTextNode = document.createTextNode(string);
		newScript.appendChild(sourceTextNode);

		if (sourceHolderEl.hasChildNodes()){
			while ( sourceHolderEl.childNodes.length >= 1 ) {
				sourceHolderEl.removeChild( sourceHolderEl.firstChild );       
			} 
		}
		
		try {
			sourceHolderEl.appendChild(newScript);
		} catch(e) {
			console.log("compile Error: "+e);
		}

		for (propertyName in window) {
			if (typesToPersistState[(typeof window[propertyName])+""]) {

				if (!firstLevel[propertyName]) { // this variable did not exist before
					initialValues[propertyName] = window[propertyName];
				} else {
					if (window[propertyName] !== firstLevel[propertyName]) { // variable changed after compilation
						if (window[propertyName] === initialValues[propertyName]) {
							// if variable was set to initial value, reset to last known value
							window[propertyName] = firstLevel[propertyName]; 
						} else { 
							// variable was set to something new, update initial value
							initialValues[propertyName] = window[propertyName];
						}
					}
				}
			}
		}
		
		// TODO: delete unused variables/functions
		// find variables in the old version that were not (re)added to the new version
		// delete them

		render();
		start();
	}
	
	function getDrawCallLineNumberForScreenLocation(x,y) {
		var wasAnimating = timeout;

		probex = x;
		probey = y;

		probeLine = -1;		
		render(true, true);

		return probeLine;
	}
	
	function render(preventVariableUpdate, useProbeContext) {
		var firstLevel =  {}, propertyName;
		
		if (preventVariableUpdate) {	
			for (propertyName in window) {
				if (window.hasOwnProperty(propertyName) && typesToPersistState[typeof window[propertyName]]) {
					firstLevel[propertyName] = window[propertyName];
				}
			}
		}
		
	 	draw(useProbeContext ? probeContext : context);
	 	
	 	
	 	if (preventVariableUpdate) {
			for (propertyName in firstLevel) {
				window[propertyName] = firstLevel[propertyName];
			}
		}
	}
	
	function start() {
		if (!timeout && framerateInterval > 0) {
			timeout = window.setInterval(render,framerateInterval);
		}
	}
	
	function stop() {
		if (timeout) {
			window.clearInterval(timeout);
		}
		timeout = undefined;
	}
	
	function displayFrameErrored (msg, linenumber) {
		console.log("user script error: "+msg);
		if (errorLineNumber >= 0) {
			editor.setLineClass(errorLineNumber,null);
			editor.clearMarker(errorLineNumber);
		}
		errorLineNumber = linenumber-1;
		editor.setLineClass(errorLineNumber,"errorLine");
		editor.setMarker(errorLineNumber," ","errorMarker");
		errorText = msg;
	}
	
	function scrollToLine(line) {
		var ycoord = editor.charCoords({line:line,ch:0}).y;
		
		// This does not work. I have no idea why not.
/* 		editor.scrollTo(0, ycoord); */
	}
	
	window.onload = function() {
		editor = CodeMirror.fromTextArea(document.getElementById("code"), {
			lineNumbers: true,
			gutter: true,
			matchBrackets: true,
			onChange:textChangeHandler,
			theme:"xcodeTheme",
			onGutterClick:gutterClicked,
			onCursorActivity:cursorActivity,
			indentWithTabs:true,
			indentUnit:4,
			tabSize:4,
			fixedGutter:true,
			onFocus: function () {editorHasFocus = true; Keys={};},
			onBlur:function(){ editorHasFocus = false; }
		});

		// view functionality
		canvas = document.getElementById("TouchCodeMainCanvas");
		context = canvas.getContext('2d');
		
		probeCanvas = document.getElementById("TouchCodeHiddenCanvas");
		probeContext = probeCanvas.getContext('2d');
		
		function probeCheck() {
			var alphaAtProbe = probeContext.getImageData(probex, probey, 1, 1).data[3];
			if (alphaAtProbe) {
				probeLine = CODEBOOK.currentOperatingLineNumber;
			}
		}
		
		//set up normal context object
		
		context.secretFillRect = context.fillRect;
		context.fillRect = function(x,y,w,h) {
			if (CODEBOOK.currentOperatingLineNumber === getHighlightLine()) {
				context.fillStyle = canvasHightlightColor;
			}
			context.secretFillRect(x,y,w,h);
		};
		
		context.secretfill = context.fill;
		context.fill = function() {
			if (CODEBOOK.currentOperatingLineNumber === getHighlightLine()) {
				context.fillStyle = canvasHightlightColor;
			}
			context.secretfill();
		};
		
		context.secretdrawImage = context.drawImage;
		context.drawImage = function(img,x,y) {
			if (CODEBOOK.currentOperatingLineNumber === getHighlightLine()) {
				probeContext.clearRect(0,0,500,500);
				probeContext.secretdrawImage(img,x,y);
				probeContext.globalCompositeOperation = "source-atop";
				probeContext.fillStyle = canvasHightlightColor;
				probeContext.secretFillRect(0,0,500,500);
				probeContext.globalCompositeOperation = "source-over";
				context.secretdrawImage(probeCanvas,0,0);
			} else {
				context.secretdrawImage(img,x,y);
			}
		};
		
		// set up probe context object

		probeContext.secretFillRect = probeContext.fillRect;
		probeContext.fillRect = function(x,y,w,h) {
			probeContext.clearRect(0,0,500,500);
			probeContext.secretFillRect(x,y,w,h);
			probeCheck();
		};
		
		probeContext.secretfill = probeContext.fill;
		probeContext.fill = function() {
			probeContext.clearRect(0,0,500,500);
			probeContext.secretfill();
			probeCheck();
		};
		
		probeContext.secretStrokeRect = probeContext.strokeRect;
		probeContext.strokeRect = function(x,y,w,h) {
			probeContext.clearRect(0,0,500,500);
			probeContext.secretStrokeRect(x,y,w,h);
			probeCheck();
		};
		
		probeContext.secretStroke = probeContext.stroke;
		probeContext.stroke = function() {
			probeContext.clearRect(0,0,500,500);
			probeContext.secretStroke();
			probeCheck();
		};
		
		probeContext.secretdrawImage = probeContext.drawImage;
		probeContext.drawImage = function(img,x,y) {
			probeContext.clearRect(0,0,500,500);

			probeContext.secretdrawImage(img,x,y);

			probeCheck();
		};

		document.addEventListener('mousedown',mouseDown, true);
		document.addEventListener('mousemove',mouseMoved, true);
		document.addEventListener('mouseup',mouseUp, false);
		document.addEventListener('mouseout',mouseoutHandler, false);	
		document.addEventListener("keydown",keyDownHandler,true);
		document.addEventListener("keyup",keyUpHandler,true);
		
		
		if (window.localStorage.code) {
			editor.setValue(window.localStorage.code);
		} else {
			textChangeHandler();
		}
		
		hightlightLine(0);
	};
	
	 window.onerror = function(msg, url, linenumber){	
		if (url.indexOf("index.html") !== -1) {
			stop();
			displayFrameErrored(msg, linenumber);
			return true; // prevent error from showing up later
		}
	};
	
	return {
		framerate: function(fps){
			if (!isNaN(fps)) {
				var newValue = (fps > 0 ? 1000/fps : 0);
				if (newValue != framerateInterval) {					
					stop();
					framerateInterval = newValue;
					start();
				}
			}
			return framerateInterval;
		},
		currentOperatingLineNumber:0
	};
}());




