const FUDAI_COLOR = colors.rgb(164, 146, 166);

function threeFingerScreenshot() {
	const screenWidth = device.width;
	const screenHeight = device.height;

	const firstPoints = {
		start: [Math.floor(screenWidth / 4), Math.floor(screenHeight / 2)],
		end: [Math.floor(screenWidth / 4), Math.floor((screenHeight * 2) / 3)],
	};

	const secondPoints = {
		start: [Math.floor(screenWidth / 2), Math.floor(screenHeight / 2)],
		end: [Math.floor(screenWidth / 2), Math.floor((screenHeight * 2) / 3)],
	};

	const thirdPoints = {
		start: [
			Math.floor((screenWidth * 3) / 4),
			Math.floor(screenHeight / 2),
		],
		end: [
			Math.floor((screenWidth * 3) / 4),
			Math.floor((screenHeight * 2) / 3),
		],
	};

	gestures(
		[
			0,
			500,
			[firstPoints.start[0], firstPoints.start[1]],
			[firstPoints.end[0], firstPoints.end[1]],
		],
		[
			0,
			500,
			[secondPoints.start[0], secondPoints.start[1]],
			[secondPoints.end[0], secondPoints.end[1]],
		],
		[
			0,
			500,
			[thirdPoints.start[0], thirdPoints.start[1]],
			[thirdPoints.end[0], thirdPoints.end[1]],
		]
	);
	sleep(200);
	const sourceDir = "/sdcard/Pictures/Screenshots"; // 替换为您的源文件夹路径
	const target = "/sdcard/DCIM/screenshot.jpg";
	// 列出文件夹 path 下的满足条件的文件和文件夹的名称的数组
	const fileList = files.listDir(sourceDir, function (filename) {
		return (
			/\.jpg$/.test(filename) &&
			files.isFile(files.join(sourceDir, filename))
		);
	});
	const lastFile = fileList[0];
	files.move(files.join(sourceDir, lastFile), target);
}

// 判断颜色相似度
function isSimilarColor(rgb1, rgb2, threshold = 10) {
	log(
		"diff",
		colors.red(rgb1) - colors.red(rgb2),
		colors.green(rgb1) - colors.green(rgb2),
		colors.blue(rgb1) - colors.blue(rgb2)
	);
	if (
		Math.abs(colors.red(rgb1) - colors.red(rgb2)) < threshold &&
		Math.abs(colors.green(rgb1) - colors.green(rgb2)) < threshold &&
		Math.abs(colors.blue(rgb1) - colors.blue(rgb2)) < threshold
	) {
		return true;
	}
	return false;
}

// 2. 获取控件区域的主要颜色
function getElementMainColor(element) {
	threeFingerScreenshot();
	const img = images.read("/sdcard/DCIM/screenshot.jpg");
	if (!img) {
		toast("截图读取失败");
		return;
	}
	const bounds = element.bounds();
	// 裁剪控件区域图片
	const clip = images.clip(
		img,
		bounds.left,
		bounds.top,
		bounds.width(),
		bounds.height()
	);

	img.recycle();

	// 采样多个点
	const points = [
		{ x: bounds.width() / 2, y: bounds.height() / 2 }, // 中心
		{ x: bounds.width() / 4, y: bounds.height() / 4 }, // 左上
		{ x: (bounds.width() * 3) / 4, y: bounds.height() / 4 }, // 右上
		{ x: bounds.width() / 4, y: (bounds.height() * 3) / 4 }, // 左下
		{ x: (bounds.width() * 3) / 4, y: (bounds.height() * 3) / 4 }, // 右下
	];

	// 获取所有采样点的RGB值
	const rgbColors = points.map((p) => {
		const pixel = images.pixel(clip, p.x, p.y);
		return {
			red: colors.red(pixel),
			green: colors.green(pixel),
			blue: colors.blue(pixel),
		};
	});

	clip.recycle();

	// 计算平均RGB值
	const avgColor = rgbColors.reduce(
		(acc, curr) => {
			return {
				red: acc.red + curr.red / rgbColors.length,
				green: acc.green + curr.green / rgbColors.length,
				blue: acc.blue + curr.blue / rgbColors.length,
			};
		},
		{ red: 0, green: 0, blue: 0 }
	);

	const avgColorRGB = colors.rgb(
		Math.floor(avgColor.red),
		Math.floor(avgColor.green),
		Math.floor(avgColor.blue)
	);

	log(
		colors.red(avgColorRGB),
		colors.green(avgColorRGB),
		colors.blue(avgColorRGB)
	);
	log(
		colors.red(FUDAI_COLOR),
		colors.green(FUDAI_COLOR),
		colors.blue(FUDAI_COLOR)
	);
	sleep(1000);
	// 将平均值转换为单个RGB颜色

	return isSimilarColor(avgColorRGB, FUDAI_COLOR);
}

// main
// 等待开启无障碍权限
auto.waitFor();

setScreenMetrics(1080, 2376);

toast("start");

console.show();
console.setPosition(Math.floor((device.width * 1) / 3), 100);
log("控制台测试信息");

// 福袋Button
let buttons = boundsInside(36, 360, 600, 468)
	.className("android.widget.FrameLayout")
	.clickable(true)
	.text("")
	.find();

// buttons.forEach((element, index) => {
// 	getElementMainColor(element);
// });
sleep(10 * 1000);

// if (buttons.length > 0) {
// 	toast("查找到符合条件的按钮数:" + buttons.length);
// 	sleep(1000);
// 	let btn = buttons[0];
// 	let x = btn.bounds().centerX();
// 	let y = btn.bounds().centerY();
// 	click(x, y);
// } else {
// 	toast("未找到按钮");
// }

var fudaiButton = boundsInside(36, 360, 555, 468)
	.className("android.widget.FrameLayout")
	.clickable(true)
	.depth(20)
	.findOne();
fudaiButton.click();
