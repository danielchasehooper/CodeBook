var TOUCHVIEW;

if (!console) {
	var console = {log: function(string){}};
}

if (typeof Object.create !== 'function') {
	Object.create = function (o) {
		function F(){}
		F.prototype = o;		
		return new F();
	};
}

Array.prototype.each = function(f){
	"use strict";
	var i;
	for (i = 0; i < this.length; i += 1) {
		f(this[i], i);
	}
};

/* 
 * API Functions 
 * These are availible to the code being run
 * 
 */ 

var draw = function(c){};

var Keys = {left:false,down:false,right:false,up:false};

function framerate(fps){
	if (!isNaN(fps)) {
		TOUCHVIEW.framerate(fps);
	}
	return TOUCHVIEW.framerateInterval;
}

function rgb(r,g,b) {
	return "rgb("+r+","+g+","+b+")";
}

function rgba(r,g,b,a) {
	return "rgba("+r+","+g+","+b+","+a+")";
}

/*
 *  Display implementation
 */

TOUCHVIEW = (function () {
	"use strict";
	
	var canvas, context;
	var probeCanvas, probeContext;
	var probeLine;
	
	var probex, probey;
	
	var scriptNode;
	var timeout;
	var initialValues = {};
	var framerateInterval = 17;
	
	/* Event Handlers */
	
	function keyDownHandler(e){
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
	}
	
	function mosedownHandler(e) {
		// var line = TOUCHVIEW.getDrawCallLineNumberForScreenLocation(e.clientX,e.clientY);
		// parent.TOUCHCODE.scrollToLine(line-1);
	}
	
	function mousemoveHandler(e){
		if (TOUCHVIEW.inspectorMode) {
			TOUCHVIEW.hightlightLine = TOUCHVIEW.getDrawCallLineNumberForScreenLocation(e.clientX,e.clientY);
			console.log(" x: "+e.clientX+" y: "+e.clientY+" line: "+TOUCHVIEW.hightlightLine);
		}
	}
	
	function mouseoutHandler(e) {
		TOUCHVIEW.hightlightLine = -1;
	}
	
	/* window Events */
	window.onload = function() {
		canvas = document.getElementById("TouchCodeMainCanvas");
		context = canvas.getContext('2d');
		
		probeCanvas = document.getElementById("TouchCodeHiddenCanvas");
		probeContext = probeCanvas.getContext('2d');
		
		function probeCheck() {
			var alphaAtProbe = probeContext.getImageData(probex, probey, 1, 1).data[3];
			if (alphaAtProbe) {
				probeLine = TOUCHVIEW.currentOperatingLineNumber;
			}
		}
		
		//set up normal context object
		
		context.secretFillRect = probeContext.fillRect;
		context.fillRect = function(x,y,w,h) {
			if (TOUCHVIEW.currentOperatingLineNumber ===  TOUCHVIEW.hightlightLine) {
				context.fillStyle = "#f00";
			}
			context.secretFillRect(x,y,w,h);
		};
		
		context.secretfill = probeContext.fill;
		context.fill = function() {
			if (TOUCHVIEW.currentOperatingLineNumber === TOUCHVIEW.hightlightLine) {
				context.fillStyle = "#f00";
			}
			context.secretfill();
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

		document.addEventListener("keydown",keyDownHandler,true);
		document.addEventListener("keyup",keyUpHandler,true);
		document.addEventListener("mousedown",mosedownHandler,true);
		document.addEventListener("mousemove",mousemoveHandler,true);
		document.addEventListener("mouseout",mouseoutHandler,true);
	};
	
 	window.onerror = function(msg, url, linenumber){		
		if (url.indexOf("display.html") !== -1) {
			TOUCHVIEW.stop();
			parent.TOUCHCODE.displayFrameErrored(msg, linenumber);
			return true; // prevent error from showing up later
		}
	};
	
	return {
		updateCode: function(string) {
			TOUCHVIEW.stop();
			
			var typesToPersistState = {
					number:true,
					boolean:true
				};

			// keep track of new variables by learning old variables
			var firstLevel =  {};
			var propertyName;
			for (propertyName in window) {
				if (typesToPersistState[typeof window[propertyName]]) {
					firstLevel[propertyName] = window[propertyName];
				}
			}

			// inject line numbers into source
			var lines = string.split("\n");
			var i;
			
			for (i = 0; i < lines.length; i++) {
				lines[i] = "TOUCHVIEW.currentOperatingLineNumber="+(i+1)+";"+lines[i];
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
			
			try{
				sourceHolderEl.appendChild(newScript);
			}catch(e) {
				console.log("compile Error: "+e);
			}

			// TODO: delete unused variables/functions

			for (propertyName in window) {
				if (typesToPersistState[(typeof window[propertyName])+""]) {

					if (!firstLevel[propertyName]) { // this is a new variable
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

			TOUCHVIEW.render();
			TOUCHVIEW.start();
		},
		getDrawCallLineNumberForScreenLocation: function(x,y) {
			var wasAnimating = timeout;

			probex = x;
			probey = y;

			probeLine = -1;
			draw(probeContext);

			return probeLine;
		},
		render: function() {
			var prop;
			
			try{
			 	draw(context);
			} catch(e) {
			/*	console.log(e);
				console.log(e.line+": "+e.message);
				for (prop in e) {
				 	console.log(prop+": "+e[prop]);
				} */
				
				// This doesn't work in all browsers
				parent.TOUCHCODE.displayFrameErrored(e.message, e.line);
				
				TOUCHVIEW.stop();
			}
		},
		start: function() {
			if (!timeout && framerateInterval > 0) {
				timeout = window.setInterval(TOUCHVIEW.render,framerateInterval);
			}
		},
		stop: function() {
			if (timeout) {
				window.clearInterval(timeout);
			}
			timeout = undefined;
		},
		framerate: function(fps) {
			var newValue = (fps > 0 ? 1000/fps : 0);
			if (newValue != framerateInterval) {					
				TOUCHVIEW.stop();
				framerateInterval = newValue;
				TOUCHVIEW.start();
			}
		},
		framerateInterval: function(){
			return framerateInterval;
		},
		hightlightLine:-1,
		currentOperatingLineNumber: 0
	};
}());



