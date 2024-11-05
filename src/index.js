const FUDAI_COLOR = colors.rgb(248, 158, 186);
const FUDAI_POS = [36, 360, 600, 468]; // 福袋按钮区域
const COUNTDOWN_POS = [0, 1083, 1080, 1395]; // 倒计时区域
const POPUP_POS = [0, 800, 1080, 2376]; // 弹窗区域
const PRIZE_POS = [48, 1335, 1032, 1779]; // 奖品参考价值区域
const JOINED_POS = [48, 2112, 1032, 2376]; // 检查是否成功参与抽奖
const ROOM_LIST_POS = [0, 264, 1080, 600]; // 检查是否成功参与抽奖
const TOP_LIST_POS = [0, 120, 1080, 252]; // 顶部列表
const MAX_WAIT_TIME = 300; // 最大等待时间
const PRIZE_PRICE_MIN = 600; // 奖品最小参考价值,低于此值则不参与抽奖
const MAX_RETRY = 3; // 重试次数
const MAX_SWIPE_TIMES = 30;
const FIND_TIMEOUT = 3000;

function clickWithLog(x, y, msg) {
	click(x, y);
	log(`${msg}:${x},${y}`);
	sleep(2000);
}

function swipWithLog(x1, y1, x2, y2, duration, msg) {
	log(`${msg}:${x1},${y1} -> ${x2},${y2}`);
	swipe(x1, y1, x2, y2, duration);
	sleep(2000);
}

function clickBlankArea() {
	clickWithLog(720, 540, "点击空白区域");
}

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
	sleep(2000);
	log("截图完成");
	clickBlankArea();
	const sourceDir = "/sdcard/Pictures/Screenshots";
	const target = "/sdcard/DCIM/screenshot.jpg";
	const fileList = files.listDir(sourceDir, function (filename) {
		return (
			/\.jpg$/.test(filename) &&
			files.isFile(files.join(sourceDir, filename))
		);
	});
	const lastFile = fileList[0];
	files.move(files.join(sourceDir, lastFile), target);
}

// 2. 获取控件区域的主要颜色
function isFudaiColor(element) {
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
		{ x: bounds.width() / 2, y: bounds.height() / 2 },
		{ x: bounds.width() / 2, y: bounds.height() / 3 },
		{ x: bounds.width() / 2, y: (bounds.height() * 2) / 3 },
		{ x: bounds.width() / 3, y: bounds.height() / 2 },
		{ x: (bounds.width() * 2) / 3, y: bounds.height() / 2 },
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
		`平均颜色:${colors.red(avgColorRGB)},${colors.green(
			avgColorRGB
		)},${colors.blue(avgColorRGB)}`
	);
	log(
		`福袋颜色:${colors.red(FUDAI_COLOR)},${colors.green(
			FUDAI_COLOR
		)},${colors.blue(FUDAI_COLOR)}`
	);

	return colors.isSimilar(avgColorRGB, FUDAI_COLOR, 12);
}

function click_popup() {
	const popup = boundsInside(
		POPUP_POS[0],
		POPUP_POS[1],
		POPUP_POS[2],
		POPUP_POS[3]
	)
		.classNameMatches(
			"(com\\.lynx\\.tasm\\.behavior\\.ui\\.view\\.UIView|com\\.lynx\\.tasm\\.ui\\.image\\.FlattenUIImage)"
		)
		.clickable(true)
		.textMatches(
			"(一键发表评论|知道了|我知道了|领取奖品|立即用券|关闭，按钮|关闭)"
		)
		.findOne(FIND_TIMEOUT);

	if (popup) {
		const x = popup.bounds().centerX();
		const y = popup.bounds().centerY();
		clickWithLog(x, y, "关闭弹窗");
	}

	clickBlankArea();
}

function getCountdownSeconds() {
	const countdown = boundsInside(
		COUNTDOWN_POS[0],
		COUNTDOWN_POS[1],
		COUNTDOWN_POS[2],
		COUNTDOWN_POS[3]
	)
		.className("com.lynx.tasm.behavior.ui.text.FlattenUIText")
		.filter(function (w) {
			return /^\d+$/.test(w.text());
		})
		.find();

	// 添加调试信息
	log("找到的倒计时元素数量:", countdown.length);
	countdown.forEach((item, index) => {
		log(`倒计时元素 ${index + 1}:`, item.text());
	});

	if (countdown.length !== 2) {
		log("倒计时识别错误");
		return -1;
	}

	const seconds =
		parseInt(countdown[0].text(), 10) * 60 +
		parseInt(countdown[1].text(), 10);

	return seconds;
}

function getPrizePrice() {
	const prize = boundsInside(
		PRIZE_POS[0],
		PRIZE_POS[1],
		PRIZE_POS[2],
		PRIZE_POS[3]
	)
		.className("com.lynx.tasm.behavior.ui.text.FlattenUIText")
		.textMatches("参考价值: ¥(\\d+)")
		.findOne(FIND_TIMEOUT);

	if (!prize) {
		log("未找到参考价值");
		return -1;
	}

	const priceMatch = prize.text().match(/参考价值: ¥(\d+)/);
	if (!priceMatch) {
		log("参考价值格式不匹配");
		return -1;
	}
	return parseInt(priceMatch[1], 10);
}

function search_fudai() {
	click_popup();
	// 福袋Button
	const fudai = boundsInside(
		FUDAI_POS[0],
		FUDAI_POS[1],
		FUDAI_POS[2],
		FUDAI_POS[3]
	)
		.className("android.widget.FrameLayout")
		.clickable(true)
		.text("")
		.find();

	threeFingerScreenshot();
	for (let i = 0; i < fudai.length; i++) {
		const x = fudai[i].bounds().centerX();
		const y = fudai[i].bounds().centerY();
		log(`福袋坐标:${x},${y},bounds:${fudai[i].bounds()}`);
		if (isFudaiColor(fudai[i])) {
			clickWithLog(x, y, "点击福袋");
			// 获取开奖倒记时;
			const lastCountdown = getCountdownSeconds();
			if (lastCountdown === -1) {
				continue;
			}
			log("福袋倒计时:", lastCountdown);
			// 获取奖品参考价值;
			const prizePrice = getPrizePrice();
			if (prizePrice === -1) {
				continue;
			}
			log("奖品参考价值", prizePrice);
			click_popup();
			if (prizePrice > PRIZE_PRICE_MIN && lastCountdown < MAX_WAIT_TIME) {
				return { x, y, lastCountdown };
			}
		}
	}

	return null;
}

function enterLiveRoom() {
	swipWithLog(750, 180, 200, 180, 2000, "尝试滑动顶部列表");
	let followBtn = boundsInside(
		TOP_LIST_POS[0],
		TOP_LIST_POS[1],
		TOP_LIST_POS[2],
		TOP_LIST_POS[3]
	)
		.className("android.widget.TextView")
		.text("关注")
		.clickable(false)
		.findOne(FIND_TIMEOUT);

	// 点击关注列表
	if (followBtn) {
		log("找到关注按钮");
		const x = followBtn.bounds().centerX();
		const y = followBtn.bounds().centerY();
		clickWithLog(x, y, "点击关注");
		swipWithLog(280, 432, 800, 432, 1000, "更新关注的直播");
		clickWithLog(120, 400, "点击进入直播间");
	} else {
		log("未找到关注按钮");
	}
}

// main
// 等待开启无障碍权限
auto.waitFor();

setScreenMetrics(1080, 2376);

console.show();
console.setPosition(0, 360);
log("开始执行");
// sleep(3000);
// enterLiveRoom();
let swipeTimes = 0;

log(`无效滑动次数:${swipeTimes}`);
if (swipeTimes > MAX_SWIPE_TIMES) {
	log(`无效滑动次数超过:${MAX_SWIPE_TIMES}次,重新进入直播间`);
	back();
	enterLiveRoom();
}

const now = new Date();
log(`当前时间:${now.getHours()}:${now.getMinutes()}`);

// if (self.NIGHT_START_HOUR <= hour <= self.NIGHT_END_HOUR) or (
// 	elapsed > self.MAX_IDLE_TIME
// ):
// 	self.back(times=5)  # 模拟返回键多次退出应用
// 	print(f"⚠️hour:{hour},elapsed:{elapsed},退出抖音,停止抽奖")
// 	return

let fudai = search_fudai();
let tryCount = 1;

// while (!fudai && tryCount < MAX_RETRY) {
// 	tryCount++;
// 	log(`未找到福袋，重试第${tryCount}次`);
// 	fudai = search_fudai();
// }

if (fudai) {
	clickWithLog(fudai.x, fudai.y, "点击福袋");
	// 查看是否成功参与抽奖
	const success = boundsInside(
		JOINED_POS[0],
		JOINED_POS[1],
		JOINED_POS[2],
		JOINED_POS[3]
	)
		.className("com.lynx.tasm.behavior.ui.text.FlattenUIText")
		.textMatches(".*参与成功.*|.*等待开奖.*")
		.exists();

	if (success) {
		log(`抽奖成功,等待:${fudai.lastCountdown}秒`);
		sleep(fudai.lastCountdown * 1000);
	} else {
		log("抽奖失败");
	}
} else {
	log(
		`未找到福袋,或倒计时大于:${MAX_WAIT_TIME}秒,或者奖品价值小于:${PRIZE_PRICE_MIN}`
	);
}
sleep(20 * 1000);
