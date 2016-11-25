
// ============== Init ACL =======================

var acl = require('acl');
acl = new acl(new acl.memoryBackend());
require('./config/acl.js')(acl);
var path = require('path');
var fs = require('fs');

function aclMiddleware (resource, action) {
	return function (req, res, next) {
		if (!('userId' in req.session)){
			return res.redirect('/home');
		}
		acl.isAllowed(req.session.userId, resource, action, function (err, result) {
			if (err){
				console.log(err);
			}
			console.log('result: ', result);
			if (result){
				next();
			}
			else {
				return res.redirect('/home');
			}
		});
	}
}

global.myCustomVars.aclMiddleware = aclMiddleware;

// ============== Mongoose Model ================
var mongoose             = require('mongoose');
var Log                  = mongoose.model('Log');

// ============== Shared Variables ================

var ACTION_CREATE = 0;
global.myCustomVars.ACTION_CREATE = ACTION_CREATE;
var ACTION_EDIT = 1;
global.myCustomVars.ACTION_EDIT = ACTION_EDIT;
var STR_SEPERATOR = '_+_';
global.myCustomVars.STR_SEPERATOR = STR_SEPERATOR;


// ============== Shared Functions ================

/**
 * Check required parameters
 */

function checkRequiredParams (requiredParams, object) {
	if (requiredParams instanceof Array){
		for (var i = 0; i < requiredParams.length; i++) {
			if (!(requiredParams[i] in object)){
				return requiredParams[i];
			}
		}
	}
	return false;
}

global.myCustomVars.checkRequiredParams = checkRequiredParams;


/**
 * Send error message to response when some action failure
 *
 * @param {Object} req request (include uploaded files)
 * @param {String} dir upload directory
 * @param {Object} res response
 * @param {Integer} errCode Status Code send to client
 * @param {String} errMessage Error
 */

function responseError (req, dir, res, errCode, props, values) {

	// Delete files in request

	if (req.files){
		for (var field in req.files){
			var files = req.files[field];
			for (var i = 0; i < files.length; i++) {
				fs.unlink(path.join(dir, files[i].filename));
			}
		}
		
	}

	// Response to client

	if ((props instanceof Array) && (values instanceof Array) && (props.length == values.length)){
		var result = {};
		result.status = 'error';
		for (var i = 0; i < props.length; i++) {
			result[props[i]] = values[i];
		}
		return res.status(errCode).json(result);
	}
}

global.myCustomVars.responseError = responseError;


/**
 * When action success
 */

function responseSuccess (res, props, values) {
	if ((props instanceof Array) && (values instanceof Array) && (props.length == values.length)){
		var result = {};
		result.status = 'success';
		for (var i = 0; i < props.length; i++) {
			result[props[i]] = values[i];
		}
		return res.status(200).json(result);
	}
	return res.status(200).json({
		status: 'success',
	})
}

global.myCustomVars.responseSuccess = responseSuccess;


function rename (curFiles, schemaField, position, mongoId) {
	// console.log(schemaField);
	try {
		schemaField.splice(0, schemaField.length); // delete all old elements
	}
	catch (e){
		console.log(e);
		schemaField = [];
	}
	for (var i = 0; i < curFiles.length; i++) {
		var file = curFiles[i];
		try {
			var curPath = path.join(position, file.filename);
			var newFileName = mongoId + STR_SEPERATOR + file.originalname;
			var newPath = path.join(position, newFileName);
			fs.renameSync(curPath, newPath);
			schemaField.push(mongoId + STR_SEPERATOR + file.originalname);
		}
		catch (e){
			console.log(e);
		}
	}
}

global.myCustomVars.rename = rename;

function propsName (_PROP_FIELDS) {
	return _PROP_FIELDS.reduce(function (preObj, curElement) {
		if (('label' in curElement) && (curElement.label)){
			preObj[curElement.name] = curElement.label;
		}
		else {
			preObj[curElement.name] = curElement.name;
		}
		return preObj;
	}, {});
}

global.myCustomVars.propsName = propsName;

function flatObjectModel (_PROP_FIELDS, objectInstance) {
	var result = {};
	_PROP_FIELDS.map(function (element) {
		// if (element.type.localeCompare('File')){
			result[element.name] = objectChild(objectInstance, element.schemaProp)[element.name];
		// }
	});
	return result;
}

global.myCustomVars.flatObjectModel = flatObjectModel;

function objectChild (object, tree) {
	var nodes = tree.trim().split('.');
	for (var i = 0; i < nodes.length; i++) {
		if (nodes[i] in object){
			object = object[nodes[i]];
		}
		else {
			object[nodes[i]] = {};
			object = object[nodes[i]];
		}
	}
	return object;
}

global.myCustomVars.objectChild = objectChild;

function createSaveOrUpdateFunction (variablesBundle) {
	var Log = variablesBundle.Log;
	var AutoCompletion = variablesBundle.AutoCompletion;
	var objectModelName = variablesBundle.objectModelName;
	var objectModelNames = variablesBundle.objectModelNames;
	var objectModelIdParamName = variablesBundle.objectModelIdParamName;
	var objectBaseURL = variablesBundle.objectBaseURL;
	var _PROP_FIELDS = variablesBundle.PROP_FIELDS;
	var _UPLOAD_DEST_ANIMAL = variablesBundle.UPLOAD_DEST_ANIMAL;
	// console.log(variablesBundle.UPLOAD_DEST_ANIMAL);
	// console.log(1);

	return function saveOrUpdate (req, res, objectInstance, action) {
		var PROP_FIELDS_OBJ = {};

		_PROP_FIELDS.map(function (element, index) {
			PROP_FIELDS_OBJ[element.name] = index;
		});

		// File fields
		var FILE_FIELDS = _PROP_FIELDS.filter(function (element) {
			return !element.type.localeCompare('File')
		});
		var objectBeforeUpdate = {};
		if (action == ACTION_EDIT){

			// Date will be converted to String.
			objectBeforeUpdate = JSON.parse(JSON.stringify(objectInstance));
		}
		
		// save props
		for (var i = 0; i < _PROP_FIELDS.length; i++) {
			var element = _PROP_FIELDS[i];
			
			// Check required
			if ((action == ACTION_CREATE) && (element.type.localeCompare('Mixed') !== 0)) {
				// Check required data props if action is create
				if (element.required && (element.type.localeCompare('File') != 0) && (!(element.name in req.body) || !(req.body[element.name]))) {
					console.log('resonpse error');
					return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], ["Thiếu tham số", element.name]);
				}

				// Check required files if action is create
				if (element.required && (element.type.localeCompare('File') == 0) && (!(element.name in req.files) || !(req.files[element.name]))){
					console.log('missing file');
					return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], ["Thiếu tham số", element.name]);
				}
			}

			// Validate data
			switch (element.type){
				case 'String':
					var value = '';
					if (element.name in req.body){
						value = req.body[element.name];
						try {
							value = value.trim();
						}
						catch (e){
							// do not care
						}
						if ('min' in element){
							if (value.length < element.min){
								return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], [element.name + ' không được ngắn hơn ' + element.min + ' ký tự', element.name]);
							}
						}

						if ('max' in element){
							if (value.length > element.max){
								return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], [element.name + ' không được ngắn hơn ' + element.max + ' ký tự', element.name]);
							}
						}
						if ('regex' in element){
							var regex = new RegExp(element.regex);
							if (regex.test(value) === false){
								return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], ['Sai định dạng', element.name]);
							}
						}
					}
					break;
				case 'Number':
					if ('min' in element){
						if (parseFloat(req.body[element.name]) < element.min){
							return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], [element.name + ' không được nhỏ hơn ' + element.min, element.name]);
						}
					}

					if ('max' in element){
						if (req.body[element.name].length > element.max){
							return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], [element.name + ' không được lớn hơn ' + element.max, element.name]);
						}
					}
					break;
				case 'File':
					if ('regex' in element){
						var regex = new RegExp(element.regex);
						if (req.files && element.name in req.files){
						// if (element.name in req.files){
							var files = req.files[element.name];
							for (var j = 0; j < files.length; j++) {
								var file = files[j];
								if (!regex.test(file.originalname)){
									// console.log(regex);
									// console.log(file.originalname);
									return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], ['Tên file trong trường không hợp lệ', element.name]);
								}
							}
						}
					}
					break;
				case 'Mixed':
					// TODO Validate sub properties
					var valid = false;
					if (action == ACTION_CREATE){
						if (element.required){
							for (var j = 0; j < element.subProps.length; j++) {
								var prop = element.subProps[j];
								var e = _PROP_FIELDS[PROP_FIELDS_OBJ[prop]];
								if (e.type.localeCompare('String') == 0 && (prop in req.body)){
									var v = req.body[prop];
									try {
										v = v.trim();
									}
									catch (e){
										// Do not care
									}
									if ('regex' in e){
										var regex = new RegExp(e.regex);
										if (regex.test(v) === false){
											return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], ['Sai định dạng', e.name]);
										}
									}
									valid = true;
									break;
								}
								if (e.type.localeCompare('Date') == 0 && (prop in req.body)){
									valid = true;
									break;
								}
								if (e.type.localeCompare('File') == 0 && (req.files) && (prop in req.files)){
									valid = true;
									break;
								}
							}
							if (!valid){
								return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], ['Thiếu tham số', element.name]);
							}
						}
					}
					else if (action == ACTION_EDIT){
						// 
						// Actually, we don't need to validate these Mixed properties.
						// Sub properties will be validated automatically
						// But we need to delete data of this field
						delete req.body[element.name];
					}
					break;
				default:
					break;
			}

			// var nodes = element.schemaProp.split('.');
			// var lastProp = nodes.splice(nodes.length - 1, 1)[0];
			// var tree = nodes.join('.');
			// objectChild(newAnimal, tree)[lastProp] = req.body[element.name];
			if (element.type.localeCompare('Mixed') && element.type.localeCompare('File') && (element.name in req.body)) {
				var value = req.body[element.name];
				try {
					value = value.trim();
				}
				catch (e){
					// do not care
				}
				objectChild(objectInstance, element.schemaProp)[element.name] = value;

				// Update Auto Completion
				if (('autoCompletion' in element) && (element.autoCompletion)){

					AutoCompletion.findOne({}, createAutoCompletionCallback(element.name, value));

					function createAutoCompletionCallback(name, value) {
						return function (err, autoCompletion) {
							if (!err){
								if (autoCompletion){
									if (name in autoCompletion){
										// Update
										if (autoCompletion[name].indexOf(value) < 0){
											autoCompletion[name].push(value);
											autoCompletion.save();
										}
									}
									else{
										autoCompletion[name] = [value];
										autoCompletion.save();
									}
								}
								else{
									// Create new documents in AutoCompletion
									autoCompletion = new AutoCompletion();
									console.log('add new auto completion row');
									autoCompletion[name] = [value];
									autoCompletion.save();
								}
							}
						}
					}
				}
			}
		}

		objectInstance.save(function (err, result) {
			if (err){
				try {
					var errField = err.errors[Object.keys(err.errors)[0]].path;
					var dotPos = errField.lastIndexOf('.');
					if (dotPos >= 0){
						errField = errField.substring(dotPos + 1);
					}
					return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error', 'field'], ['Dữ liệu nhập vào không hợp lệ', errField]);
				}
				catch (e){
					console.log(err);
					console.log('Server error');
				}
				return responseError(req, _UPLOAD_DEST_ANIMAL, res, 400, ['error'], ['Error while saving to database']);
			}

			// rename images
			FILE_FIELDS.map(function (element) {
				// console.log('---');
				// console.log(element.name);
				// if (req.files){
				// 	console.log(element.name in req.files);
				// 	if (element.name in req.files){
				// 		console.log(req.files[element.name]);
				// 	}
				// }
				
				// console.log('---');
				// console.log(objectChild(animal, element.schemaProp)[element.name]);
				if (req.files && (element.name in req.files) && req.files[element.name]){
					// console.log('new file for ' + element.name);
					// var nodes = element.schemaProp.split('.');
					// var lastProp = nodes.splice(nodes.length - 1, 1)[0];
					// var tree = nodes.join('.');
					// objectChild(animal, tree)[lastProp] = [];
					// rename(req.files[element.name], objectChild(animal, element.schemaProp), UPLOAD_DEST_ANIMAL, result.id);

					if (action == ACTION_EDIT){
						
						// TODO
						// need to delete old files.
						// console.log('delete old files');
						var files = objectChild(objectInstance, element.schemaProp)[element.name];
						// console.log(files);
						for (var j = 0; j < files.length; j++) {
							fs.unlink(path.join(_UPLOAD_DEST_ANIMAL, files[j]));
						}

					}
					objectChild(objectInstance, element.schemaProp)[element.name] = [];
					rename(req.files[element.name], objectChild(objectInstance, element.schemaProp)[element.name], _UPLOAD_DEST_ANIMAL, result.id);
				}
			})

			if (action == ACTION_CREATE){
				objectInstance.created_at = new Date();
			}
			else {
				objectInstance.updated_at = new Date();
			}
			objectInstance.save(function (err, r) {
				if (err){
					console.log(err);
				}

				var newLog = new Log();
				newLog.action = (action == ACTION_CREATE) ? 'create' : 'update';
				newLog.time = new Date();
				newLog.objType = objectModelName;
				newLog.userId = req.user.id;
				if (action == ACTION_CREATE){
					newLog.obj1 = JSON.parse(JSON.stringify(objectInstance));
				}
				else {
					newLog.obj1 = objectBeforeUpdate;
					newLog.obj2 = JSON.parse(JSON.stringify(objectInstance));
				}
				newLog.userFullName = req.user.fullname;
				newLog.save();
				res.status(200).json({
					status: 'success'
				});
			});
		})
	}
}


global.myCustomVars.createSaveOrUpdateFunction = createSaveOrUpdateFunction;

function exportFile (objectInstance, PROP_FIELDS, ObjectModel, LABEL, res, paragraph) {

	function display(obj){
		// console.log(staticPath)
		// console.log(count)
		if (obj instanceof Array){
			var result =  obj.reduce(function (preStr, curElement, curIndex){
				// console.log(curElement.split('_+_')[1]);
				preStr += curElement.split('_+_')[1];
				if (curIndex < obj.length - 1){
					preStr += '\n\n';
				}
				return preStr;
			}, '');
			return result;
		}
		else if (obj instanceof Date){
			return [obj.getDate(), obj.getMonth() + 1, obj.getFullYear()].join(' / ');
		}
		// Need to escape to prevent injected HTML + JS
		return obj;
	}


	function inOrder (tree) {
		if (!tree){
			return;
		}
		if (tree instanceof Function){
			return;
		}
		if (typeof(tree) == 'string'){
			return;
		}
		for(var i = 0; i < Object.keys(tree).length; i++){
			var prop = Object.keys(tree)[i];
			console.log(stt + ' : ' + prop + ' : ' + curDeep);
			// Add data to docx object
			var p;
			switch (curDeep){
				case 0:
					// Label
					try{
						p = LABEL[prop];
					}
					catch (e){
						console.log(e);
						// Do not care;
						// break;
					}
					var row = [
						{
							val: p,
							opts: rowSpanOpts
						},
						{
							val: '',
							opts: rowSpanOpts
						},
						{
							val: '',
							opts: rowSpanOpts
						},
						{
							val: '',
							opts: rowSpanOpts
						}
					];
					table.push(row);
					break;
				case 1:
					stt++;
					// console.log('printing ' + prop);
					// var value = flatOI[prop];
					// if ((flatOI[prop] instanceof Object) && (Object.keys(flatOI[prop]) > 0)){
					// 	value = JSON.stringify(flatOI[prop]);
					// }
					// if ((flatOI[prop] instanceof Object) && (Object.keys(flatOI[prop]) < 1)){
					// 	value = '';
					// }
					var value = display(flatOI[prop]);
					try{

						if (PROP_FIELDS[PROP_FIELDS_OBJ[prop]].label){
							p = PROP_FIELDS[PROP_FIELDS_OBJ[prop]].label
						}
					}
					catch (e){
						// console.log(e);
						// Do not care;
						// console.log(prop + ' : index : ' + PROP_FIELDS_OBJ[prop])
					}

					
					var row = [
						{
							val: stt,
							opts: labelOpts
						},
						{
							val: p,
							opts: detailOpts
						},
						{
							val: value,
							opts: detailOpts
						},
						{
							val: '',
							opts: detailOpts
						}
					]
					if (value){
						table.push(row);
					}
					break;
				case 2:
					// var value = flatOI[prop];
					// if ((flatOI[prop] instanceof Object) && (Object.keys(flatOI[prop]) > 0)){
					// 	value = JSON.stringify(flatOI[prop]);
					// }
					// if ((flatOI[prop] instanceof Object) && (Object.keys(flatOI[prop]) < 1)){
					// 	value = '';
					// }
					var value = display(flatOI[prop]);
					try{

						if (PROP_FIELDS[PROP_FIELDS_OBJ[prop]].label){
							p = PROP_FIELDS[PROP_FIELDS_OBJ[prop]].label
						}
					}
					catch (e){
						console.log(e);
						// Do not care;
						console.log(prop + ' : index : ' + PROP_FIELDS_OBJ[prop])
					}
					var row = [
						{
							val: '',
							opts: labelOpts
						},
						{
							val: p,
							opts: detailOpts
						},
						{
							val: value,
							opts: detailOpts
						},
						{
							val: '',
							opts: detailOpts
						}
					]
					if (value){
						table.push(row);
					}
					break;
			}

			// console.log('inc curDeep');
			
			// stt++;
			curDeep++;
			inOrder(tree[prop]);
			curDeep--;
		}
	}

	var fs = require('fs');
	var officegen = require('officegen');
	var docx = officegen({
		type: 'docx',
		subjects: 'Mẫu phiếu dữ liệu',
		orientation: 'landscape'
	});

	docx.on('finalize', function (written) {
		console.log("Docx: written " + written + " bytes.");
	});

	docx.on('error', function (error) {
		console.log("Docx: Error");
		console.log(error);
		console.log("===");
	})

	

	for(var i = 0; i < paragraph.text.length; i++){
		var pObj = docx.createP();
		pObj.options.align = "center";
		pObj.addText(paragraph.text[i] + '\n\n', paragraph.style[i]);
	}

	var flatOI = flatObjectModel(PROP_FIELDS, objectInstance);

	var pObj = docx.createP();
	pObj.options.align = "center";
	pObj.addText('Mã đề tài: ' + display(flatOI.maDeTai), {color: '000000', bold: true, font_face: 'Times New Roman', font_size: 12});

	var rowSpanOpts = {
		// cellColWidth: 2261,
		b:true,
		sz: '24',
		align: 'center',
		shd: {
			fill: "CCCCCC",
			// themeFill: "text1",
			// "themeFillTint": "30"
		},
		// gridSpan: 3,
		fontFamily: "Times New Roman"
	};

	var labelOpts = {
		cellColWidth: 500,
		b:true,
		sz: '24',
		align: 'center',
		shd: {
			fill: "FFFFFF",
			// themeFill: "text1",
			// "themeFillTint": "30"
		},
		fontFamily: "Times New Roman"
	};

	var detailOpts = {
		// cellColWidth: 2261,
		// b:true,
		sz: '24',
		shd: {
			fill: "FFFFFF",
			// themeFill: "text1",
			// "themeFillTint": "30"
		},
		fontFamily: "Times New Roman"
	};

	var table = [
	[
		{
			val: "STT",
			opts: labelOpts
		},
		{
			val: "Trường dữ liệu",
			opts: labelOpts
		},
		{
			val: "Nội dung",
			opts: labelOpts
		},
		{
			val: "Ghi chú",
			opts: labelOpts
		}
	]];
	
	var oi = {};
	PROP_FIELDS.map(function (field) {
		if (field.name != 'maDeTai'){
			objectChild(oi, field.schemaProp)[field.name] = {};
		}
		
		// console.log(oi);
	});

	var PROP_FIELDS_OBJ = {};

	PROP_FIELDS.map(function (element, index) {
		PROP_FIELDS_OBJ[element.name] = index;
	});
	var curDeep = 0;
	var stt = 0;
	
	

	inOrder(oi);

	var tableStyle = {
		tableColWidth: 3200,
		// tableSize: 200,
		// tableColor: "ada",
		tableAlign: "left",
		tableFontFamily: "Times New Roman",
		borders: true
	}

	docx.createTable (table, tableStyle);
	// var fs = require('fs');
	var tmpFileName = (new Date()).getTime() + '.tmp.docx';
	var outputStream = fs.createWriteStream(path.join(__dirname, tmpFileName));
	outputStream.on('close', function () {
		console.log('output done.');
		console.log(LABEL);
		var outputFileName = 'PCSDL';
		try {
			if (LABEL.objectModelLabel){
				outputFileName += '_' + LABEL.objectModelLabel;
			}
			if (flatOI.tenVietNam){
				outputFileName += '_' + flatOI.tenVietNam;
			}
			if (flatOI.soHieuBaoTangCS){
				outputFileName += '_' + flatOI.soHieuBaoTangCS;
			}
		}
		catch (e){
			console.log(e);
		}
		finally {
			outputFileName += '.docx';
		}
		res.download(path.join(__dirname, tmpFileName), outputFileName);
		setTimeout(function () {
			fs.unlink(path.join(__dirname, tmpFileName));
		}, 2000);
		// res.end("OK");
	});
	docx.generate(outputStream);


	// Assume objectInstance is a tree (JSON),
	// with depth <= 3

}

global.myCustomVars.exportFile = exportFile;