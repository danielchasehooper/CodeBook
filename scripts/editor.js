

if (!console) {
	var console = {log: function(string){}};
}

function exists(value) {
	return (typeof value !== "undefined" && value !== null);
}

var TOUCHCODE = (function(){
	"use strict";
	var editor;
	var LiveViewBridge;
	var jslintWorker;
	var errors = [];
	
	var errorLineNumber = -1;
	var errorText = "";
	var isSlidingNumber = false;
	var lastMousePosition = false;
	var lastCursorLine;
	var controlPressed;
	
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
	
	function textChangeHandler(editor, info) {
		if (jslintWorker) {
			jslintWorker.postMessage({cmd:"STOP"});
			jslintWorker = undefined;
		}
		
		// clear markers
		// editor.setLineClass(errorLine,null);
		// 		editor.clearMarker(errorLine);
		errorLineNumber = -1;
		hideErrorPopover();
		errors = [];
		
		var i;
		console.log("clearning line markers");
		for (i = 0; i < editor.lineCount(); i++) {
			editor.setLineClass(i,undefined);
			editor.clearMarker(i);
		}
		
		var editorString = editor.getValue();
		window.localStorage.code = editorString;

		if (!isSlidingNumber){
			console.log("Messaging worker");
			jslintWorker = new Worker('scripts/jsLintWorker.js')
			jslintWorker.addEventListener("message",lintParsingComplete,false);
			jslintWorker.postMessage({cmd:"lint",code:editorString});
		}
		
		// TODO: should liveview only be updated if code is valid? 
		LiveViewBridge.updateCode(editorString);
	}
	
	 function showErrorForLine(line) {
		var errorString = "";
		var i;
		for (i =0; i < errors.length; i++) {
			if (errors[i].line === line) {
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

	function mouseDownOnEditor(event){
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

	function moveMoved(event){
		if (isSlidingNumber) {
			isSlidingNumber.dragged = true;
			var newString = String(parseFloat(isSlidingNumber.string)+(event.pageX - lastMousePosition.x));
			editor.replaceRange(newString,
			{line:isSlidingNumber.lineNumber, 
				ch:isSlidingNumber.start},
				{line:isSlidingNumber.lineNumber, 
					ch:isSlidingNumber.end});

			isSlidingNumber.string = newString;
			isSlidingNumber.end = isSlidingNumber.start+isSlidingNumber.string.length;
			
			 editor.setSelection(
			 									{line:isSlidingNumber.lineNumber, 
			 						ch:isSlidingNumber.start},
			 						{line:isSlidingNumber.lineNumber, 
			 							ch:isSlidingNumber.end});
			event.stopPropagation();
		}

		lastMousePosition = {x:event.pageX,y:event.pageY};
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

	window.onload = function() {
		LiveViewBridge = window.frames[0].TOUCHVIEW;

		editor = CodeMirror.fromTextArea(document.getElementById("code"), {
			lineNumbers: true,
			matchBrackets: true,
			onChange:textChangeHandler,
			theme:"xcodeTheme",
			onGutterClick:gutterClicked,
			onCursorActivity:cursorActivity,
			indentWithTabs:true,
			indentUnit:4,
			tabSize:4,
			fixedGutter:true
		});

		if (window.localStorage.code) {
			editor.setValue(window.localStorage.code);
		} else {
			updateDisplayCode();
		}

		document.getElementById("codeContainer").addEventListener('mousedown',mouseDownOnEditor, true);
		document.addEventListener('mousemove',moveMoved, true);
		document.addEventListener('mouseup',mouseUp, false);
		document.addEventListener('mouseout',mouseUp, false);	
		
		document.addEventListener('keydown',function(e) {
			
			if (e.keyCode === 91) {
				controlPressed = true;
				LiveViewBridge.inspectorMode = true;
			}
		}, false);
		
		document.addEventListener('keyup',function(e) {
			if (e.keyCode === 91) {
				controlPressed = false;
				LiveViewBridge.inspectorMode = false;
				LiveViewBridge.hightlightLine = -1;
			}
		}, false);
	};
	
	return {
		displayFrameErrored: function (msg, linenumber) {
			console.log("user script error: "+msg);
			if (errorLineNumber >= 0) {
				editor.setLineClass(errorLineNumber,null);
				editor.clearMarker(errorLineNumber);
			}
			errorLineNumber = linenumber-1;
			editor.setLineClass(errorLineNumber,"errorLine");
			editor.setMarker(errorLineNumber," ","errorMarker");
		//	TOUCHCODE.scrollToLine(linenumber-1);
			errorText = msg;
		},
		scrollToLine: function(line) {
			editor.scrollTo(0,editor.charCoords({line:line,ch:0}).y);
			// editor.setCursor({line:isSlidingNumber.lineNumber,ch:isSlidingNumber.end});
			editor.setSelection({line:line, 
									ch:0},
									{line:line, 
										ch:100});
		}
	};
}());
