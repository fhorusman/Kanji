var gradeMode = [], // Array of selected grade modes that would be chosen at random
	plate, // Selected Kanji
	plateGrade; // Selected Kanji's grade
var randomGrade = true, // 'true' value would include all grades when randomizing
	fullanswer = false; // 'true' if the answer needed to be complete
var r; // Raphael object holder
var disable = false; // 'true' when the kanji game paused
var correctSound, errorSound; // The sound triggered when user confirm their answer
var gameMode = "normal", kanjiChoice = "both";

var starFullImg, starHalfFullImg, starEmptyImg;
var heartImg, addHeartImg, removeHeartImg;
var startTime;

var temporaryGradeList = [];
var temporaryKanjiList = {};

/* All Kanji that has been selected combined in one big array */
var activeKanjiList = {
	keys: [],
	values: [],
	size: 0,
	multipleInstanceFactor: 5,
	addItems: function(key,items) {
		this.keys.push(key);
		
		var markedKanjiArray = saver.getMarkedKanjiArray()[key];
		if(markedKanjiArray) {
			var unmarkedKanjiArray = items.slice(0);
			var index = 0;
		
 			while(index < unmarkedKanjiArray.length) {
				var removed = false;
				for(var i = 0; i < markedKanjiArray.length; i++) {
					if(unmarkedKanjiArray[index][0] == markedKanjiArray[i]) {
						removed = unmarkedKanjiArray.splice(index, 1);
						break;
					}
				}
			
				if(!removed) {
					index++;
				}
			}
			var repeatable = (this.multipleInstanceFactor) - Math.round((Math.ceil(unmarkedKanjiArray.length * 100 / items.length) * this.multipleInstanceFactor) / 100);
			for(var i = 0; i < repeatable; i++) {
				unmarkedKanjiArray = unmarkedKanjiArray.concat(unmarkedKanjiArray);
			}
//			console.log("repeatable=", repeatable, "unmarkedKanjiArray.length=",unmarkedKanjiArray.length);
			items = items.concat(unmarkedKanjiArray);
		}
		
		this.values[key] = items;
		this.size += items.length;
//		console.log("added", items.length, "total=", this.size);
//		console.log("Keys", this.keys);
		return this.values;
	},
	removeItems: function(key) {
		if(!this.values[key]) return;
		this.keys.splice(this.keys.indexOf(key), 1);
		this.size -= this.values[key].length;
//		 console.log("removed", this.values[key].length, "remaining=", this.size);
		delete this.values[key];
	},
	get: function(index) {
//		console.log("activeSize", this.size);
		for(var i = 0, pointer = 0; i < this.keys.length; i++) {
			if(index < this.values[this.keys[i]].length + pointer ) {
				return this.values[this.keys[i]][index - pointer];
			}
			pointer += this.values[this.keys[i]].length;
		}
	},
	refreshList: function(key) {
		this.removeItems(key);
		this.addItems(key,temporaryKanjiList[key]);
	},
	clearAll: function() {
		this.keys = [];
		this.values = [];
		this.size = 0;
	}
};

/* Loader of images and sound */
var loader = {
	loaded: true,
	loadedCount: 0, // Assets that have been loaded so far
	totalCount: 0, // Total number of assets that need to be loaded
	init: function() {
		// check for sound support
		var mp3Support, oggSupport;
		var audio = document.createElement('audio');
		if(audio.canPlayType) {
			// Currently canPlayType() returns "", "maybe", "probably"
			mp3Support = "" != audio.canPlayType('audio/mpeg');
			oggSupport = "" != audio.canPlayType('audio/ogg; codecs="vorbis"');
		} else {
			// The audio tag is not supported
			mp3Support = false;
			oggSupport = false;
		}
		
		// Check for ogg, then mp3, and finally set soundFileExtn to undefined
		loader.soundFileExtn = oggSupport ? ".ogg" : mp3Support ? ".mp3" : undefined;
	},
	loadImage: function(url) {
		this.totalCount++;
		this.loaded = false;
		loader.showLoadingScreen();
		var image = new Image();
		image.src = url;
		image.onload = loader.itemLoaded();
		return image;
	},
	soundFileExtn: ".ogg",
	loadSound: function(url) {
		this.totalCount++;
		this.loaded = false;
		loader.showLoadingScreen();
		var audio = new Audio();
		audio.src = url + loader.soundFileExtn;
		audio.addEventListener("canplaythrough", loader.itemLoaded, false);
		return audio;
	},
	itemLoaded: function() {
		loader.loadedCount++;
		$('#loadingmessage').html('Loaded ' + loader.loadedCount + ' of ' + loader.totalCount);
		if(loader.loadedCount === loader.totalCount) {
			// Loader has loaded completely
			loader.loaded = true;
			// Hide loading screen
			loader.hideLoadingScreen();
			// And call the loader.onload method if it exists
			if(loader.onload) {
				loader.onload();
				loader.onload = undefined;
			}
		}
	},
	showLoadingScreen: function() {
		disableComponent(true);
		$('#loadingscreen').show();
	},
	hideLoadingScreen: function() {
		disableComponent(false);
		$('#loadingscreen').hide();
		$("#container input").attr("disabled", false);
	}
	
};

/* The important thing */
function init() {
	$("#gamewarning").hide();
	$("#gamecontainer").show();
	// load all sound
	loader.init();
	correctSound = loader.loadSound('audio/tong');
	errorSound = loader.loadSound('audio/dong');
	starFullImg = loader.loadImage('images/Star-full-icon.png');
	starHalfFullImg = loader.loadImage('images/Star-half-full-icon.png');
	starEmptyImg = loader.loadImage('images/Star-empty-icon.png');
	heartImg = loader.loadImage('images/Fav-icon.png');
	addHeartImg = loader.loadImage('images/Add-fav-icon.png');
	removeHeartImg = loader.loadImage('images/Remove-fav-icon.png');
	
	// Load data or create new save slot
	saver.init();
	
	$('#meaning').hide();
	$('#kana').hide();
	r = Raphael("holder");
	
	drawIcon();
	// add grade checkboxes
	var parent = $("#grademode");
	if(!gradeMode) gradeMode = new Array();
	for(var i = 0; i < grade.length; i++) {
		
		var gradeDiv = $(document.createElement('div')).attr({ subtitle: "parts" + i}).addClass("gradediv");
		var gradeChoice = $(document.createElement('input')).attr({ 
			type: "checkbox", 
			id: grade[i], 
			name: grade[i], 
			subtitle: "parts" + i,
			value: grade[i]}).addClass("gradechoice");
		
		var label = $(document.createElement('label')).attr({ "for": grade[i], title: kanji[grade[i]].length + " characters"}).html(grade[i])
			.addClass("tooltip");
		
		gradeDiv.append(gradeChoice);
		gradeDiv.append(label);
		
		if(kanji[grade[i]].length > 100) {	
			gradeChoice.hide();
			
			var variable = Math.ceil(kanji[grade[i]].length / 40);
			var lengthPerPart = Math.ceil(kanji[grade[i]].length / variable);
			var numKanjiDiv = $(document.createElement('div')).attr({id : "parts" + i }).addClass("numkanjidiv").hide();
			
			for(var j = 0; j < variable; j++) {
				var gradeChildChoice = $(document.createElement('input')).attr({ 
					type: "checkbox", 
					id: grade[i] + j, 
					name: grade[i] + j, 
					value: grade[i] + "part" +j}).addClass("gradechild");
				var gradechildlist = kanji[grade[i]].slice(j * lengthPerPart, (j + 1) * lengthPerPart);
				temporaryKanjiList[grade[i] + "part" + j] = gradechildlist;
				temporaryGradeList.push(grade[i] + "part" + j);
				
				var childLabel = $(document.createElement('label')).attr({ "for": grade[i] + j, title: gradechildlist.length + " characters"}).html("Part " + (j + 1))
						.addClass("tooltip");
				numKanjiDiv.append(gradeChildChoice);		
				numKanjiDiv.append(childLabel);
				if(variable > j + 1) numKanjiDiv.append("<br>");
				
				gradeChildChoice.click(changeGrade);
				
				if(gradeMode.indexOf(grade[i] + "part" + j) >= 0) {
					gradeChildChoice.attr({checked: true});
					numKanjiDiv.show();
					activeKanjiList.addItems(grade[i] + "part" + j, gradechildlist);
				}
			}
			
		} else {
			
			temporaryGradeList.push(grade[i]);
			temporaryKanjiList[grade[i]] = kanji[grade[i]];
			gradeChoice.click(changeGrade);

			if(gradeMode.indexOf(grade[i]) >= 0) {
				gradeChoice.attr({checked: true});
				activeKanjiList.addItems(grade[i], kanji[grade[i]]);
			}
		}
		
		parent.append(gradeDiv);
		
		if(!numKanjiDiv) {
			// gradeDiv.append("<br>");
		} else {
			parent.append(numKanjiDiv);
			gradeDiv.addClass("selectable");
			gradeDiv.click(function(e){
//				console.log(e.target.getAttribute("subtitle"));
				if(!$("#" + e.target.getAttribute("subtitle")).is(':visible')) {
					$("#grademode div").removeClass("selected");
					$(this).addClass("selected");
					$(".numkanjidiv").hide('fast');
					$("#" + e.target.getAttribute("subtitle")).show('fast');
				} else {
					$(this).removeClass("selected");
					$(".numkanjidiv").hide('fast');
				}
			});
		}
	}
	// console.log(parent.parent());
	parent.parent().append("<br>");
	
	var randomGradeField = $(document.createElement('input')).attr({ 
		type: "checkbox", 
		id: "checkAllGrade", 
		name: "checkAllGrade", 
		value: "checkAllGrade",
		checked: false}).addClass("gradechoice");
	
	randomGradeField.click(function(e) {
		var checkboxes = $('#grademode').find(':checkbox').not($(this));
		// console.log("checkboxes", checkboxes);
		checkboxes.attr('checked', e.target.checked);
		if(e.target.checked) {
			gradeMode = temporaryGradeList.slice(0);
		} else {
			gradeMode.splice(0,gradeMode.length);
		}	

		activeKanjiList.clearAll();
		for(var i = 0; i < gradeMode.length; i++) {
			activeKanjiList.addItems(gradeMode[i],temporaryKanjiList[gradeMode[i]]);
		}

		refreshKanjiPlate();
		saver.saveDailyProgress(0,0,randomGrade,gradeMode);
	});
	
	var label = $(document.createElement('label')).attr({ "for": "checkAllGrade"}).html("Check/Uncheck All");
	
	parent.parent().append(randomGradeField);
	parent.parent().append(label);
	
	// add action listener for help checkboxes
	$('#translation').click(function(e) {
		if(e.target.checked) $('#meaning').show();
		else $('#meaning').hide();
	});
	
	$('#character').click(function(e) {
		if(e.target.checked) $('#kana').show();
		else $('#kana').hide();
	});
	
	$('#showstatistic').click(function(e) {
		e.preventDefault();
		if(!disable) displayStatistics();
	});
	
	$('#showhowtoplay').click(function(e) {
		e.preventDefault();
		if(!disable) displayHowToPlay();
	});
	
	$('#clearmark').click(function(e) {
		e.preventDefault();
		if(!disable) {
			var r = confirm("Do you really want to clear the starred kanji list?");
			if(r) {
				saver.clearMarkedKanjiArray();
				refreshKanjiPlate();
			}
		}
	});
	
	$('#answerform').submit(function(e) {
		checkAnswer();
		e.preventDefault;
		return false;
	});
	
	createMarker();
	createUnmarker();
	// console.log(temporaryGradeList, temporaryGradeList.length);
	refreshKanjiPlate();
	$('.tooltip').tooltipster({
		delay:0,
		position: 'right',
		theme: '.tooltipster-light',
		speed: 125,
	});
}

function createMarker() {
	var marker = document.createElement('a');
	var backgroundImage = document.createElement('img');
	marker.onclick = function(e) {
		e.preventDefault();
		saver.saveMarkedKanji(plate, plateGrade);
		activeKanjiList.refreshList(plateGrade);
		$('#unstar').hide();
		$('#star').show();
	}
	backgroundImage.src = starEmptyImg.src;
	marker.onmouseover = function() {
		backgroundImage.src = starHalfFullImg.src;
	};
	marker.onmouseout = function() {
		backgroundImage.src = starEmptyImg.src;
	}
	
	marker.setAttribute('href','#');
	marker.setAttribute('id','unstar');
	marker.appendChild(backgroundImage);
	
	var parent = document.getElementById("mark");
	parent.appendChild(marker);
}

function createUnmarker() {
	var marker = document.createElement('a');
	var backgroundImage = document.createElement('img');
	marker.onclick = function(e) {
		e.preventDefault();
		saver.removeMarkedKanji(plate, plateGrade);
		activeKanjiList.refreshList(plateGrade);
		$('#unstar').show();
		$('#star').hide();
	}
	
	backgroundImage.src = starFullImg.src;
	marker.onmouseover = function() {
		backgroundImage.src = starHalfFullImg.src;
	};
	marker.onmouseout = function() {
		backgroundImage.src = starFullImg.src;
	}
	
	marker.setAttribute('href','#');
	marker.setAttribute('id','star');
	marker.appendChild(backgroundImage);
	
	var parent = document.getElementById("mark");
	parent.appendChild(marker);
}

function changeGrade(e) {
	if(e.target.checked) {
		gradeMode.push(e.target.value);
		activeKanjiList.addItems(e.target.value, temporaryKanjiList[e.target.value]);
	} else {
		gradeMode.splice(gradeMode.indexOf(e.target.value),1);
		activeKanjiList.removeItems(e.target.value);
	}
//	console.log(gradeMode.length);
	refreshKanjiPlate();
	saver.saveDailyProgress(0,0,randomGrade,gradeMode);
}

// The icon vectors
var helpPath = "M16,1.466C7.973,1.466,1.466,7.973,1.466,16c0,8.027,6.507,14.534,14.534,14.534c8.027,0,14.534-6.507,14.534-14.534C30.534,7.973,24.027,1.466,16,1.466zM24.386,14.968c-1.451,1.669-3.706,2.221-5.685,1.586l-7.188,8.266c-0.766,0.88-2.099,0.97-2.979,0.205s-0.973-2.099-0.208-2.979l7.198-8.275c-0.893-1.865-0.657-4.164,0.787-5.824c1.367-1.575,3.453-2.151,5.348-1.674l-2.754,3.212l0.901,2.621l2.722,0.529l2.761-3.22C26.037,11.229,25.762,13.387,24.386,14.968z",
	ideaPath = "M12.75,25.498h5.5v-5.164h-5.5V25.498zM15.5,28.166c1.894,0,2.483-1.027,2.667-1.666h-5.334C13.017,27.139,13.606,28.166,15.5,28.166zM15.5,2.833c-3.866,0-7,3.134-7,7c0,3.859,3.945,4.937,4.223,9.499h1.271c-0.009-0.025-0.024-0.049-0.029-0.078L11.965,8.256c-0.043-0.245,0.099-0.485,0.335-0.563c0.237-0.078,0.494,0.026,0.605,0.25l0.553,1.106l0.553-1.106c0.084-0.17,0.257-0.277,0.446-0.277c0.189,0,0.362,0.107,0.446,0.277l0.553,1.106l0.553-1.106c0.084-0.17,0.257-0.277,0.448-0.277c0.189,0,0.36,0.107,0.446,0.277l0.554,1.106l0.553-1.106c0.111-0.224,0.368-0.329,0.604-0.25s0.377,0.318,0.333,0.563l-1.999,10.998c-0.005,0.029-0.02,0.053-0.029,0.078h1.356c0.278-4.562,4.224-5.639,4.224-9.499C22.5,5.968,19.366,2.833,15.5,2.833zM17.458,10.666c-0.191,0-0.364-0.107-0.446-0.275l-0.554-1.106l-0.553,1.106c-0.086,0.168-0.257,0.275-0.446,0.275c-0.191,0-0.364-0.107-0.449-0.275l-0.553-1.106l-0.553,1.106c-0.084,0.168-0.257,0.275-0.446,0.275c-0.012,0-0.025,0-0.037-0.001l1.454,8.001h1.167l1.454-8.001C17.482,10.666,17.47,10.666,17.458,10.666z",
	statisticPath = "M21.25,8.375V28h6.5V8.375H21.25zM12.25,28h6.5V4.125h-6.5V28zM3.25,28h6.5V12.625h-6.5V28z",
	scorePath = "M16,1.466C7.973,1.466,1.466,7.973,1.466,16c0,8.027,6.507,14.534,14.534,14.534c8.027,0,14.534-6.507,14.534-14.534C30.534,7.973,24.027,1.466,16,1.466z M17.255,23.88v2.047h-1.958v-2.024c-3.213-0.44-4.621-3.08-4.621-3.08l2.002-1.673c0,0,1.276,2.223,3.586,2.223c1.276,0,2.244-0.683,2.244-1.849c0-2.729-7.349-2.398-7.349-7.459c0-2.2,1.738-3.785,4.137-4.159V5.859h1.958v2.046c1.672,0.22,3.652,1.1,3.652,2.993v1.452h-2.596v-0.704c0-0.726-0.925-1.21-1.959-1.21c-1.32,0-2.288,0.66-2.288,1.584c0,2.794,7.349,2.112,7.349,7.415C21.413,21.614,19.785,23.506,17.255,23.88z",
	gradePath = "M6.63,21.796l-5.122,5.121h25.743V1.175L6.63,21.796zM18.702,10.48c0.186-0.183,0.48-0.183,0.664,0l1.16,1.159c0.184,0.183,0.186,0.48,0.002,0.663c-0.092,0.091-0.213,0.137-0.332,0.137c-0.121,0-0.24-0.046-0.33-0.137l-1.164-1.159C18.519,10.96,18.519,10.664,18.702,10.48zM17.101,12.084c0.184-0.183,0.48-0.183,0.662,0l2.156,2.154c0.184,0.183,0.184,0.48,0.002,0.661c-0.092,0.092-0.213,0.139-0.334,0.139s-0.24-0.046-0.33-0.137l-2.156-2.154C16.917,12.564,16.917,12.267,17.101,12.084zM15.497,13.685c0.184-0.183,0.48-0.183,0.664,0l1.16,1.161c0.184,0.183,0.182,0.48-0.002,0.663c-0.092,0.092-0.211,0.138-0.33,0.138c-0.121,0-0.24-0.046-0.332-0.138l-1.16-1.16C15.314,14.166,15.314,13.868,15.497,13.685zM13.896,15.288c0.184-0.183,0.48-0.181,0.664,0.002l1.158,1.159c0.183,0.184,0.183,0.48,0,0.663c-0.092,0.092-0.212,0.138-0.332,0.138c-0.119,0-0.24-0.046-0.332-0.138l-1.158-1.161C13.713,15.767,13.713,15.471,13.896,15.288zM12.293,16.892c0.183-0.184,0.479-0.184,0.663,0l2.154,2.153c0.184,0.184,0.184,0.481,0,0.665c-0.092,0.092-0.211,0.138-0.33,0.138c-0.121,0-0.242-0.046-0.334-0.138l-2.153-2.155C12.11,17.371,12.11,17.075,12.293,16.892zM10.302,24.515c-0.091,0.093-0.212,0.139-0.332,0.139c-0.119,0-0.238-0.045-0.33-0.137l-2.154-2.153c-0.184-0.183-0.184-0.479,0-0.663s0.479-0.184,0.662,0l2.154,2.153C10.485,24.036,10.485,24.332,10.302,24.515zM10.912,21.918c-0.093,0.093-0.214,0.139-0.333,0.139c-0.12,0-0.24-0.045-0.33-0.137l-1.162-1.161c-0.184-0.183-0.184-0.479,0-0.66c0.184-0.185,0.48-0.187,0.664-0.003l1.161,1.162C11.095,21.438,11.095,21.735,10.912,21.918zM12.513,20.316c-0.092,0.092-0.211,0.138-0.332,0.138c-0.119,0-0.239-0.046-0.331-0.138l-1.159-1.16c-0.184-0.184-0.184-0.48,0-0.664s0.48-0.182,0.663,0.002l1.159,1.161C12.696,19.838,12.696,20.135,12.513,20.316zM22.25,21.917h-8.67l8.67-8.67V21.917zM22.13,10.7c-0.09,0.092-0.211,0.138-0.33,0.138c-0.121,0-0.242-0.046-0.334-0.138l-1.16-1.159c-0.184-0.183-0.184-0.479,0-0.663c0.182-0.183,0.479-0.183,0.662,0l1.16,1.159C22.312,10.221,22.313,10.517,22.13,10.7zM24.726,10.092c-0.092,0.092-0.213,0.137-0.332,0.137s-0.24-0.045-0.33-0.137l-2.154-2.154c-0.184-0.183-0.184-0.481,0-0.664s0.482-0.181,0.664,0.002l2.154,2.154C24.911,9.613,24.909,9.91,24.726,10.092z";
	
function drawIcon() {
	$('#helpicon').html("");
	$('#scoreicon').html("");
	$('#gradeicon').html("");
	$('#ideaicon').html("");
	
	var c = Raphael('helpicon');
	c.setSize(32,32);
	c.path(helpPath).attr({fill: "#000", stroke: "none"});
	c = Raphael('scoreicon');
	c.setSize(32,32);
	c.path(scorePath).attr({fill: "#000", stroke: "none"});
	c = Raphael('gradeicon');
	c.setSize(32,32);
	c.path(gradePath).attr({fill: "#000", stroke: "none"});
	c = Raphael('ideaicon');
	c.setSize(32,32);
	c.path(ideaPath).attr({fill: "#000", stroke: "none"});
}

function refreshKanjiPlate() {
	console.time("refreshKanji");
	var tempPlate, tempActiveKanjiList;
	var markedKanjiArray = saver.getMarkedKanjiArray();
	do {
		if(kanjiChoice == "both") {
			console.log("randomGrade", randomGrade, "gradeMode.length", gradeMode.length);
			if(gradeMode.length == 0) {
				var tempSelectedGrade = temporaryGradeList[Math.floor(Math.random() * temporaryGradeList.length)];
				var tempIndex = Math.floor(Math.random() * temporaryKanjiList[tempSelectedGrade].length);
				tempPlate = temporaryKanjiList[tempSelectedGrade][tempIndex];
			} else {
				tempPlate = activeKanjiList.get(Math.floor(Math.random() * activeKanjiList.size));
			}
		} else if(kanjiChoice == "markedonly") {
			// Still in development
			if(!tempActiveKanjiList) {
				tempActiveKanjiList = [];
				for(var i = 0; i < gradeMode; i++) {
					var newArray = markedKanjiArray[gradeMode[i]];
					if(newArray) {
						tempActiveKanjiList = tempActiveKanjiList.concat(markedKanjiArray[gradeMode[i]]);
					}
				}
			}
			
			if(tempActiveKanjiList.length < 0) {
				tempPlate = ["Empty",["No Kanji Starred"],["No Kanji Starred"],["XAmaksiasd1230148198273-032039841--!@1321409*$)!@#)984123"]]
				break;
			} else {
				tempPlate = tempActiveKanjiList[Math.floor(Math.random() * tempActiveKanjiList.length)];
			}
			
			
		} else if(kanjiChoice == "unmarkedonly") {
			// Still in development
			tempPlate = ["XXX",["System Unimplemented"],["System Unimplemented"],["XAmaksiasd1230148198273-032039841--!@1321409*$)!@#)984123"]]
			break;
		}
	} while(plate == tempPlate);
	plate = tempPlate;
	
	plateGrade = findKanjiGrade(plate);
	
	if(markedKanjiArray[plateGrade] && markedKanjiArray[plateGrade].indexOf(plate[0]) >= 0) {
		$('#unstar').hide();
		$('#star').show();
	} else {
		$('#unstar').show();
		$('#star').hide();
	}
	
	$('#kanji').html(plate[0]);
	$('#kana').html(plate[2].join(', '));
	if(plate[1].length > 0 && plate[1][0] != "") {
		$('#meaning').html(plate[1].join(', '));
	} else {
		$('#meaning').html(plate[3].join(', '));
	}
	console.timeEnd("refreshKanji");
}

function findKanjiGrade(plate) {
//	console.time("findKanji");
	var gradeName;
	for(var i = 0; i < temporaryGradeList.length; i++) {
		var kanjiList = temporaryKanjiList[temporaryGradeList[i]];
		for(var j = 0; j < kanjiList.length; j++) {
			if(plate == kanjiList[j]) {
				gradeName = temporaryGradeList[i];
			}
		}
	}
	console.info("findKanji", gradeName);
	return gradeName;
}

function animateScore(value, id) {
	var span = document.createElement('span');
	span.setAttribute("id", "incrementedScore");
	span.innerHTML = value;
	var scoreLabel = document.getElementById(id);
	scoreLabel.appendChild(span);
	$('#incrementedScore').hide(1000);
}

function refreshScore(correct, error) {
	$('#correct').html('Correct: ' + correct);
	$('#error').html('Error: ' + error);
}

function hideStatistics() {
	disableComponent(false);
	$('#statistics').hide();
}

function displayStatistics() {
	var labels = []; 
	var answers = [], corrects = [], errors = [];
	answers.push(corrects);
	answers.push(errors);
	var progressKeyArray = saver.getProgressKeyArray();
	for(var i = 0; i < progressKeyArray.length; i++) {
		var temp = JSON.parse(localStorage[progressKeyArray[i]]);
		labels.push(temp.date);
		corrects.push(temp.correct);
		errors.push(temp.error);
		if(i < (progressKeyArray.length - 1)) {
			var today = new Date(temp.date);
			var endDate = new Date(JSON.parse(localStorage[progressKeyArray[i + 1]]).date);
			endDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000));
			while(today < endDate) {
				var tomorrow = new Date(today.getTime() + (24 * 60 * 60 * 1000));
				labels.push(tomorrow.toDateString());
				corrects.push(0);
				errors.push(0);
				today = tomorrow;
			}
		}
	}
	
	var barWidth = corrects.length * 40, width = barWidth;
	if(width < 1024) width = 1024;
	
	r.setSize(width, 460);
	
	var correctFill = "#1F81CF";
	var errorFill = "#CF4E1F";
	var fin = function () {
		var str;
		if(this.bar.attrs.fill == correctFill) str = "Correct: ";
		else str = "Error: "
		this.flag = r.popup(this.bar.x, this.bar.y, str + (this.bar.value || "0")).insertBefore(this);
	};
	var fout = function () {
		this.flag.animate({opacity: 0}, 300, function () {this.remove();});
	};
	
	var fin2 = function () {
		var y = [], res = [];
		for (var i = this.bars.length; i--;) {
			y.push(this.bars[i].y);
			res.push(this.bars[i].value || "0");
		}
		this.flag = r.popup(this.bars[0].x, Math.min.apply(Math, y), res.join(", ")).insertBefore(this);
	};
	
	var fout2 = function () {
		this.flag.animate({opacity: 0}, 200, function () {this.remove();});
	};
	
	var txtattr = { font: "9pt 'Letter Gothic Std'", fill: "white" };
	disableComponent(true);
	$('#statistics').show();
	r.clear();
	var c = r.barchart(0, 40, barWidth, 300, answers, {colors: [correctFill, errorFill], type: "soft", stretch: true}).hover(fin, fout);
	var bars = c.bars;
	var z = 55;
	for(var i = 0; i < labels.length; i++) {
		var bar = bars[0][i];
		var text = r.text(bar.x + (bar.w / 2), 340, labels[i]).attr(txtattr);
		var box = text.getBBox();
		text.transform("r90t" + box.width/2 + ",0");
		z += 101;
	}
}

function hideHowToPlay() {
	disableComponent(false);
	$('#howtoplay').hide();
}

function displayHowToPlay() {
	disableComponent(true);
	$('#howtoplay').show();
}

function setMode(mode) {
	this.gameMode = mode;
}

function setKanjiChoice(mode) {
	this.kanjiChoice = mode;
}

function disableComponent(lazy) {
	disable = lazy;
	if(disable) {
		$('#container').addClass('blurred');
	} else {
		$('#container').removeClass('blurred');
	}
	
	$("#container input").attr("disabled", disable);
}

function checkAnswer() {
	var inputs = $('#answerform :input').serializeArray();
	$('#answerform')[0].reset();
	
	var answers = inputs[0].value.replace(/\ /g, "").split(",");
	answers = cleanArray(answers);
	if(answers.length == 0) return;
	
	var scoremultiplier = 1;
	
	if(this.gameMode === "fullanswer") {
		scoremultiplier = 2;
		if(answers.length != plate[3].length) {
			errorSound.play();
			saver.updateKanjiScore(plate[0],0,1);
			saver.saveDailyProgress(0, 1 * scoremultiplier, randomGrade, gradeMode);
			animateScore("+" + (1 * scoremultiplier), 'error');
			return;
		}
	}
	
	check: for(var j = 0; j < answers.length; j++) {
		var answer = answers[j];
		for(var i = 0; i < plate[3].length; i++) {
			var correctAnswer = plate[3][i];
			if(correctAnswer.toUpperCase() === answer.toUpperCase()) {
				continue check;
			}
		}	
		errorSound.play();
		saver.updateKanjiScore(plate[0],0,1);
		saver.saveDailyProgress(0, 1 * scoremultiplier, randomGrade, gradeMode);
		animateScore("+" + (1 * scoremultiplier), 'error');
		return;
	}
	correctSound.play();
	refreshKanjiPlate();
	saver.updateKanjiScore(plate[0],1,0);
	saver.saveDailyProgress(answers.length * scoremultiplier, 0, randomGrade, gradeMode);
	animateScore("+" + (answers.length * scoremultiplier), 'correct');
	return;
}

//Clear array from duplicate elements and data type: undefined, "", false, null, 0, NaN
function cleanArray(actual){
  	var newArray = new Array();
  	check: for(var i = 0; i < actual.length; i++){
      	if (actual[i]){
			for(var j = 0; j < newArray.length; j++) {
				if(actual[i] == newArray[j]) continue check;
			}
        	newArray.push(actual[i]);
    	}
  	}
  	return newArray;
}

/* Its job is to save the game configuration to localStorage */
var saver = {
	init: function () {
		var scoreProgress;
		if(!this.isSaveSlotHasBeenCreated()) {
			// If player hasn't been playing this game this day.
			var progressKeyArray = this.getProgressKeyArray();
			if(progressKeyArray.length > 0) {
				// If player had played this game, then we will use the previous game mode
				var key = progressKeyArray[progressKeyArray.length - 1];
				// console.log(key);
				scoreProgress = JSON.parse(localStorage[key]);
				scoreProgress = this.saveDailyProgress(0, 0, scoreProgress.randomGrade, scoreProgress.gradeMode);
			} else {
				// If this is the first time user ever played this game or when no playing data saved
				scoreProgress = this.createSaveSlot();
			}
		} else {
			// User had been playing this game today and open it again
			scoreProgress = this.loadProgress();
		}
		randomGrade = scoreProgress.randomGrade;
		gradeMode = scoreProgress.gradeMode;
		refreshScore(scoreProgress.correct, scoreProgress.error);
	},
	saveDailyProgress: function (addedCorrect, addedError, isRandom, selectedGrades) {
		var scoreProgress;

		// Load data before saving to synchronize score.
		if(!this.isSaveSlotHasBeenCreated()) {
			scoreProgress = this.createSaveSlot();
		} else {
			scoreProgress = this.loadProgress();
		}

		scoreProgress.correct += addedCorrect;
		scoreProgress.error += addedError;
		scoreProgress.randomGrade = isRandom;
		scoreProgress.gradeMode = selectedGrades;

		localStorage.setItem(scoreProgress.key, JSON.stringify(scoreProgress));
		refreshScore(scoreProgress.correct, scoreProgress.error);

		return scoreProgress;
	},
	isSaveSlotHasBeenCreated: function () {
		var key = "progress_" + new Date().toDateString();
		if(localStorage[key]) {
			return true;
		} else return false;
	},
	createSaveSlot: function () {
		var key = "progress_" + new Date().toDateString();
		var progressKeyArray = this.getProgressKeyArray();
		progressKeyArray.push(key);
		localStorage.setItem("progressKeyArray", JSON.stringify(progressKeyArray));
		
		var scoreProgress = {"date": new Date().toDateString(), "correct": 0, "error": 0, "randomGrade": randomGrade, "gradeMode": gradeMode, "key":key};
		localStorage.setItem(key, JSON.stringify(scoreProgress));

		return scoreProgress;
	},
	loadProgress: function () {
		var key = "progress_" + new Date().toDateString();
		var progress = JSON.parse(localStorage[key]);
		return progress;
	},
	getProgressKeyArray: function () {
		var progressKeyArray = localStorage.getItem("progressKeyArray");
		if(!progressKeyArray) {
			progressKeyArray = [];
			localStorage.setItem("progressKeyArray", JSON.stringify(progressKeyArray));
		} else {
			progressKeyArray = JSON.parse(progressKeyArray);
		}

		return progressKeyArray;
	},
	saveMarkedKanji: function(kanji, kanjiGrade) {
		var markedKanjiArray = this.getMarkedKanjiArray();
		if(kanjiGrade) {
			if(markedKanjiArray[kanjiGrade] && markedKanjiArray[kanjiGrade].indexOf(kanji[0]) < 0) {
				markedKanjiArray[kanjiGrade].push(kanji[0]);
				localStorage.setItem("markedKanjiArray", JSON.stringify(markedKanjiArray));
			} else if(!markedKanjiArray[kanjiGrade]) {
				markedKanjiArray[kanjiGrade] = [kanji[0]];
				// console.log(JSON.stringify(markedKanjiArray));
				localStorage.setItem("markedKanjiArray", JSON.stringify(markedKanjiArray));
			}
		}
	},
	removeMarkedKanji: function(kanji, kanjiGrade) {
		var markedKanjiArray = this.getMarkedKanjiArray();
		
		if(markedKanjiArray[kanjiGrade] && markedKanjiArray[kanjiGrade].indexOf(kanji[0]) >= 0) {
			markedKanjiArray[kanjiGrade].splice(markedKanjiArray[kanjiGrade].indexOf(kanji[0]),1);
			localStorage.setItem("markedKanjiArray", JSON.stringify(markedKanjiArray));
		}
	},
	getMarkedKanjiArray: function() {
		var markedKanjiArray = localStorage.getItem("markedKanjiArray");
		if(!markedKanjiArray) {
			markedKanjiArray = {};
			localStorage.setItem("markedKanjiArray", JSON.stringify(markedKanjiArray));
		} else {
			markedKanjiArray = JSON.parse(markedKanjiArray);
		}
		
		return markedKanjiArray;
	},
	clearMarkedKanjiArray: function() {
		localStorage.setItem("markedKanjiArray", JSON.stringify({}));
	},
	updateKanjiScore: function(kanji, addedCorrect, addedError) {
		var kanjiInStorage = localStorage[kanji];
		if(!kanjiInStorage) {
			kanjiInStorage = {
				correct: 0,
				error: 0
			}
		} else {
			kanjiInStorage = JSON.parse(kanjiInStorage);
		}
		
		kanjiInStorage.correct += addedCorrect;
		kanjiInStorage.error += addedError;
		localStorage.setItem(kanji, JSON.stringify(kanjiInStorage));
	},
}