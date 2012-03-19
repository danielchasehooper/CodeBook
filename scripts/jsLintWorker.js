importScripts("jslint.js");

this.onmessage = function(e) {  
    
	if (e.data.cmd === "STOP") {
	 	this.close();
	} else if (e.data.cmd === "lint"){
		var passed = lint(e.data.code);
		this.postMessage({
			passed:passed,
			errors:JSLINT.errors
		});
	}
};

function lint(string) {
	var string = "/*global\n'color','framerate','Keys','console'*/"+string; 	//undef:true
	var passed = JSLINT(string, {browser:true,sloppy:true, es5:true,evil: true, nomen: true, regexp: true, white:true, plusplus:true, vars:true});
	
	if (!passed) {
		var i;
		for (i = 0; i < JSLINT.errors.length; i++) {
			if (JSLINT.errors[i]) {
				JSLINT.errors[i].line-=2; // compensate for global comment
			}
		}
	}
	
	return passed;
}