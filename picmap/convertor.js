var fs = require('fs'),
	path = require('path'),
	util = require('util'),
	PNG = require('pngjs').PNG;

var GrowingPacker = require('../lib/GrowingPacker'),	
	nf = require('../lib/node-file.js'),
	ztool = require('../lib/ztool');

function createPng(width, height) {
	var png = new PNG({
		width : width,
		height : height
	});
	//先把所有元素置空，防止污染
	for (var y = 0; y < png.height; y++) {
		for (var x = 0; x < png.width; x++) {
			var idx = (png.width * y + x) << 2;
			png.data[idx] = 0;
			png.data[idx + 1] = 0;
			png.data[idx + 2] = 0;
			png.data[idx + 3] = 0;
		}
	}
	return png;
}
function compareString(a, b){
	var len = Math.min(a.length, b.length);
	for (var i=0; i <len; i++){
		var v = a.charCodeAt(i) - b.charCodeAt(i);		
		if (v>0)
			return 1;
		else if (v<0)
			return -1;
	}
	if (a.length>len)
		return 1;
	else if (b.length>len)
		return -1;
	return 0;
}
//*************************************************************
//  输出预览内容
//*************************************************************
var previewItemHtml = [
'\t<div>',
'\t\t<h3>.x-CLZ</h3>',
'\t\t<span class="CLZ" style="INFO"></span><span class="label">INFO</span>',
'\t</div>'
].join("\n");
function getPreviewContent(arr) {
	var htm = [], demoCss = [];
	arr.forEach(function(item){
		var clz = item.className;
		htm.push(previewItemHtml.replace(/INFO/g, item.whStyle).replace(/CLZ/g, clz));
		demoCss.push('.'+clz + '{' +  item.whStyle + ';.x-' + clz +';}');
	});
	return {
		demoCss : demoCss.join("\n"),
		body : htm.join("\n")
	};
}
//*************************************************************
//写入样式文件
//*************************************************************
function writeStyleSheetFile(filename, imgInfoArr, ifPreview) {
	var arr = [];
	var content = [];
	imgInfoArr.forEach(function(obj){
		var clzName = obj.className;
		var whStyle = 'width: '+ obj.width + 'px; height:' + obj.height + 'px;';
		arr.push({className : clzName, whStyle :  whStyle});
		content = content.concat(['.x-' + clzName + '(){',
			'\t/*' + whStyle + '*/',
			'\tbackground-position : ' + Number(0 - obj.fit.x) + 'px ' + Number(0 - obj.fit.y) + 'px;', 
		'}']);
	});	
	_writeFile(filename, content.join("\n"));
	console.log("Output icon css to " + filename);
	return ifPreview?getPreviewContent(arr):null;
}

function collectImage(imageFileName, cbFn){
	var result = {};	
	var pngParser = new PNG();
	fs.createReadStream(imageFileName).pipe(pngParser);
	pngParser.on('parsed', function () {
		result.image = this;
		result.width = this.width;
		result.height = this.height;	
		
		var size = 0;
		this.pack().on('data', function(chunk) {
			size += chunk.length;
		}).on('end', function() {
			result['size'] = size;
			cbFn(result);
		});
	});
}
function packImages(imgInfos) {
	var imgInfoArr = new Array();
	
	imgInfos.forEach(function(oImg){
		imgInfoArr.push(oImg);
	});
	imgInfoArr.sort(function(a, b) {
		return compareString(a.className, b.className);//b.h - a.h;
	});
	
	//对图片进行坐标定位
	var packer = new GrowingPacker();
	packer.fit(imgInfoArr);
	imgInfoArr.root = packer.root;
	// console.info("packer after fit :" + util.inspect(imgInfoArr));
	return imgInfoArr;
}

//*************************************************************
//	输出合并的图片
//*************************************************************
function drawImages(imageFile, imgInfoArr, callback){
	var imageResult = createPng(imgInfoArr.root.w, imgInfoArr.root.h);
	ztool.forEach(imgInfoArr, function (j, obj, goon) {
		//对图片进行定位和填充
		var image = obj.image;
		// console.info("icon image is :");
		// console.info(image);
		image.bitblt(imageResult, 0, 0, image.width, image.height,
			obj.fit.x, obj.fit.y);
		goon();
	}, function (count) {
		nf.mkdirsSync(path.dirname(imageFile));
		//图片填充
		imageResult.pack().pipe(fs.createWriteStream(imageFile));
		console.log("output icon image to ", imageFile);
		callback();
	});
} 

//*************************************************************
//	主逻辑
//*************************************************************
exports.merge = function (cfg, cb) {
	var imageInfoCache = [];
	
	var srcPath = cfg.src,
		destDir = cfg.dest,
		filename = cfg.filename,
		classPrefix = cfg.classPrefix,
		margin = cfg.margin|| 16;
	//读取图片信息
	function readImgInfo(_fname, callback) {
		var fname = _fname.split(".");
		if (fname.length!=2 || fname[1].toLowerCase() !="png")
			return callback();
		
		collectImage(srcPath + "/" + _fname, function(result){
			result.className = classPrefix + fname[0];
			result.w = result.width + margin;
			result.h = result.height + margin;
			imageInfoCache.push(result);
			callback();
		});
	}
	function output(){
		//空白图片不需要输出
		if (imageInfoCache.length==0)
			return cb(null);
		//console.info(imageInfoCache.length);
		//合并图片并定位
		var imgInfoArr = packImages(imageInfoCache);
		drawImages(destDir + "/img/" + filename + ".png", imgInfoArr, function(){
			cb(writeStyleSheetFile(destDir + "/css/" + filename + ".less",  imgInfoArr, cfg.ifPreview));
		});
	} 
	fs.readdir(srcPath, function (err, files) {
		//console.info("icons file list: " + files);
		ztool.forEach(files, function (j, fname, goon) {
			readImgInfo(fname, goon);
		}, output);
	});
};
