var fs = require('fs'),
	path = require('path'),
	util = require('util');

var ztool = require('../lib/ztool.js');

// function to encode file data to base64 encoded string
function base64_encode(file) {
	//read binary data
	var bitmap = fs.readFileSync(file);
	//convert binary data to base64 encoded string
	return new Buffer(bitmap).toString('base64');
}

//*************************************************************
//	输出预览内容
//*************************************************************
var previewItemHtml = [
'\t<div>', 
	'\t\t<h3>.x-NAME</h3>',
	'\t\t<div class="NAME" style="INFO">INFO</span></div>',
'\t</div>'
].join("\n");
function getPreviewContent(infoCache) {
	var htm = [], demoCss = [];
	infoCache.forEach(function(info){
		var clz = info.className;
		htm.push(previewItemHtml.replace(/NAME/g, clz).replace(/INFO/g, info.style));
		demoCss.push('.'+clz + '{' +  info.style + ';.x-' + clz +';}');
	});
	return {
		demoCss : demoCss.join("\n"), 
		body : htm.join("\n")
	};
}
//*************************************************************
//输出样式文件
//*************************************************************
function writeStyleSheetFile(filename, infoCache, ifPreview) {
	var content = [];	

	infoCache.forEach(function(obj){
		content = content.concat('.x-' + obj.className + '() {',
			'\t/*' + obj.style + '*/',
			'\tbackground : url(data:image/png;base64,' + obj.base64 + ') ' + obj.direction + ';',			
		  '}');
	});
	_writeFile(filename, content.join('\n'));
	console.log("Output background css to " + filename);
	return ifPreview?getPreviewContent(infoCache):null;
}

//*************************************************************
//	主逻辑
//*************************************************************
exports.merge = function (cfg, cb) {
	var filename  = cfg.dest + "/css/" + cfg.filename + ".less";
	var imageInfoCache = [];
	
	//读取图片信息
	var srcPath = cfg.src;
	var clzPrefix = cfg.classPrefix ;
	function collect(fname){
		var arr = fname.split(".");
		if (arr.pop().toLowerCase()!="png")
			return;
		var arr1 = arr[0].split("_");
		var isH = arr1[0].toLowerCase() == 'h';
		//通过图片的文件名获取样式数据
		imageInfoCache.push( {
			direction : isH ? 'repeat-x' : 'repeat-y',
			style : (isH?"height:":"width:") + arr1[1] + "px;",
			base64 : base64_encode(srcPath + "/" + fname),
			className : clzPrefix + arr[0]
		});		
	}
	function output(){
		//空白图片不需要输出
		if (imageInfoCache.length==0)
			return cb(null);
		//console.info(imageInfoCache.length);
		cb(writeStyleSheetFile(filename, imageInfoCache, cfg.ifPreview));
	} 
	fs.readdir(srcPath, function (err, files) {
		//console.info("background list :\n\t" + util.inspect(files));
		ztool.forEach(files, function (j, fname, goon) {
			collect(fname);	
			goon();
		}, output);
	});
};
