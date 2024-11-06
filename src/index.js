function sleepWithLog(duration) {
	if (duration) {
		log(`😴 休眠${duration / 1000}秒`);
		sleep(duration);
	} else {
		log(`😴 休眠${SLEEP_DURATION / 1000}秒`);
		sleep(SLEEP_DURATION);
	}
}

function clickWithLog(x, y, msg) {
	click(x, y);
	log(`${msg}:${x},${y}`);
	sleepWithLog();
}

function swipWithLog(x1, y1, x2, y2, duration, msg) {
	log(`${msg}:${x1},${y1} -> ${x2},${y2}`);
	swipe(x1, y1, x2, y2, duration);
	sleepWithLog();
}

function swipUpWithLog() {
	let center_x = Math.floor(screenWidth * 0.8);
	let y1 = Math.floor(screenHeight * 0.8);
	let y2 = Math.floor(screenHeight * 0.3);
	let duration = 200;
	swipWithLog(center_x, y1, center_x, y2, duration, "向上滑动");
	sleepWithLog();
}

function clickBlankArea() {
	clickWithLog(720, 540, "🧿	点击空白区域");
}

function threeFingerScreenshot(target) {
	let firstPoints = {
		start: [Math.floor(screenWidth * 0.3), Math.floor(screenHeight * 0.5)],
		end: [Math.floor(screenWidth * 0.3), Math.floor(screenHeight * 0.7)],
	};

	let secondPoints = {
		start: [Math.floor(screenWidth * 0.5), Math.floor(screenHeight * 0.5)],
		end: [Math.floor(screenWidth * 0.5), Math.floor(screenHeight * 0.7)],
	};

	let thirdPoints = {
		start: [Math.floor(screenWidth * 0.7), Math.floor(screenHeight * 0.5)],
		end: [Math.floor(screenWidth * 0.7), Math.floor(screenHeight * 0.7)],
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
	sleepWithLog();
	log("📱	截屏完成");
	clickBlankArea();
	const sourceDir = "/sdcard/Pictures/Screenshots";

	let fileList = files.listDir(sourceDir, function (filename) {
		return (
			/\.jpg$/.test(filename) &&
			files.isFile(files.join(sourceDir, filename))
		);
	});
	let lastFile = fileList[0];
	files.move(files.join(sourceDir, lastFile), target);
}

// 2. 获取控件区域的主要颜色
function isFudaiColor(element) {
	let bounds = element.bounds();
	if (!element || bounds.width() <= 0 || bounds.height() <= 0) {
		return false;
	}
	let img = images.read("/sdcard/DCIM/screenshot.jpg");
	if (!img) {
		toast("🚫	截图读取失败");
		return;
	}

	// 裁剪控件区域图片
	let clip = images.clip(
		img,
		bounds.left,
		bounds.top,
		bounds.width(),
		bounds.height()
	);

	img.recycle();

	// 采样多个点
	let points = [
		{ x: bounds.width() / 2, y: bounds.height() / 2 },
		{ x: bounds.width() / 2, y: bounds.height() / 3 },
		{ x: bounds.width() / 2, y: (bounds.height() * 2) / 3 },
		{ x: bounds.width() / 3, y: bounds.height() / 2 },
		{ x: (bounds.width() * 2) / 3, y: bounds.height() / 2 },
	];

	// 获取所有采样点的RGB值
	let rgbColors = points.map((p) => {
		let pixel = images.pixel(clip, Math.floor(p.x), Math.floor(p.y));
		return {
			red: colors.red(pixel),
			green: colors.green(pixel),
			blue: colors.blue(pixel),
		};
	});

	clip.recycle();

	// 计算平均RGB值
	let avgColor = rgbColors.reduce(
		(acc, curr) => {
			return {
				red: acc.red + curr.red / rgbColors.length,
				green: acc.green + curr.green / rgbColors.length,
				blue: acc.blue + curr.blue / rgbColors.length,
			};
		},
		{ red: 0, green: 0, blue: 0 }
	);

	let avgColorRGB = colors.rgb(
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

	return colors.isSimilar(avgColorRGB, FUDAI_COLOR, 4);
}

function getTimestamp() {
	return new Date().getTime(); // 返回毫秒级时间戳
}

function clickPopup() {
	let popup = boundsInside(
		POPUP_POS[0],
		POPUP_POS[1],
		POPUP_POS[2],
		POPUP_POS[3]
	)
		.classNameMatches(
			"(com\\.lynx\\.tasm\\.behavior\\.ui\\.view\\.UIView|com\\.lynx\\.tasm\\.ui\\.image\\.FlattenUIImage|com\\.lynx\\.tasm\\.behavior\\.ui\\.text\\.FlattenUIText)"
		)
		.clickable(true)
		.textMatches(
			"(一键发表评论|参与抽奖|知道了|我知道了|领取奖品|立即用券|关闭，按钮|关闭)"
		)
		.findOne(FIND_TIMEOUT);

	if (popup) {
		if (popup.text() === "领取奖品") {
			threeFingerScreenshot(`/sdcard/DCIM/中奖-${getTimestamp()}.jpg`);
		}
		let x = popup.bounds().centerX();
		let y = popup.bounds().centerY();
		clickWithLog(x, y, "🍾	关闭弹窗");
	}

	clickBlankArea();
}

function getCountdownSeconds() {
	let countdown = boundsInside(
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
	for (let index = 0; index < countdown.length; index++) {
		let item = countdown[index];
		log(`⏰	倒计时 ${index + 1}:`, item.text());
		let x = item.bounds().centerX();
		let y = item.bounds().centerY();
		log(`📌	倒计时坐标:${x},${y}`);
	}

	if (countdown.length !== 2) {
		log("🚫	倒计时识别错误");
		return -1;
	}

	let seconds =
		parseInt(countdown[0].text(), 10) * 60 +
		parseInt(countdown[1].text(), 10);

	return seconds;
}

function getPrizePrice() {
	let prize = boundsInside(
		PRIZE_POS[0],
		PRIZE_POS[1],
		PRIZE_POS[2],
		PRIZE_POS[3]
	)
		.className("com.lynx.tasm.behavior.ui.text.FlattenUIText")
		.textMatches("参考价值: ¥(\\d+)")
		.findOne(FIND_TIMEOUT);

	if (!prize) {
		log("🚫	未找到参考价值");
		return -1;
	}

	let priceMatch = prize.text().match(/参考价值: ¥(\d+)/);
	if (!priceMatch) {
		log("🚫	参考价值格式不匹配");
		return -1;
	}
	return parseInt(priceMatch[1], 10);
}
function joinFanClub() {
	for (let i = 0; i < 2; i++) {
		let fanClubButton = boundsInside(
			POPUP_POS[0],
			POPUP_POS[1],
			POPUP_POS[2],
			POPUP_POS[3]
		)
			.classNameMatches(
				"(com\\.lynx\\.tasm\\.behavior\\.ui\\.text\\.FlattenUIText|com\\.lynx\\.tasm\\.behavior\\.ui\\.view\\.UIView|com\\.lynx\\.tasm\\.behavior\\.ui\\.LynxFlattenUI)"
			)
			.textMatches(".*加入粉丝团.*")
			.findOne(FIND_TIMEOUT);

		if (fanClubButton) {
			let x = fanClubButton.bounds().centerX();
			let y = fanClubButton.bounds().centerY();
			clickWithLog(x, y, "❤️	加入粉丝团");
			if (i === 1) {
				return true;
			}
		} else {
			break;
		}
	}
	return false;
}

function search_fudai() {
	clickPopup();
	// 福袋Button
	let fudai = boundsInside(
		FUDAI_POS[0],
		FUDAI_POS[1],
		FUDAI_POS[2],
		FUDAI_POS[3]
	)
		.className("android.widget.FrameLayout")
		.clickable(true)
		.text("")
		.find();

	threeFingerScreenshot("/sdcard/DCIM/screenshot.jpg");

	for (let i = 0; i < fudai.length; i++) {
		let item = fudai[i];
		let x = item.bounds().centerX();
		let y = item.bounds().centerY();
		log(`🎁	福袋坐标:${x},${y}`);
		if (isFudaiColor(item)) {
			clickWithLog(x, y, "🎁	点击福袋");
			// 获取开奖倒计时;
			let lastCountdown = getCountdownSeconds();
			if (lastCountdown === -1) {
				continue;
			}
			log("⏰	福袋倒计时:", lastCountdown);
			// 获取奖品参考价值;
			let prizePrice = getPrizePrice();
			if (prizePrice === -1) {
				continue;
			}
			log("🎁	奖品参考价值", prizePrice);
			// 奖品价值大于最小参考价值时,检查是否符合抽奖条件,不符合则尝试获取抽奖资格
			if (prizePrice > PRIZE_PRICE_MIN) {
				if (joinFanClub()) {
					clickBlankArea();
					clickWithLog(x, y, "🎁	点击福袋");
				}
			}
			clickPopup();

			return { x, y, lastCountdown, prizePrice };
		}
	}

	return null;
}

function enterLiveRoom() {
	swipWithLog(
		TOP_LIST_SWIPE[0], // START_X
		TOP_LIST_SWIPE[1], // START_Y
		TOP_LIST_SWIPE[2], // END_X
		TOP_LIST_SWIPE[3], // END_Y
		TOP_LIST_SWIPE[4], // DURATION
		"尝试滑动顶部列表"
	);
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
		log("❤️	找到关注按钮");
		let x = followBtn.bounds().centerX();
		let y = followBtn.bounds().centerY();
		clickWithLog(x, y, "点击关注");
		swipWithLog(
			FOLLOW_LIST_SWIPE[0], // START_X
			FOLLOW_LIST_SWIPE[1], // START_Y
			FOLLOW_LIST_SWIPE[2], // END_X
			FOLLOW_LIST_SWIPE[3], // END_Y
			FOLLOW_LIST_SWIPE[4], // DURATION
			"更新关注的直播"
		);
		clickWithLog(ENTER_LIVE_POS[0], ENTER_LIVE_POS[1], "点击进入直播间");
	} else {
		log("💔	未找到关注按钮");
	}
}

function exitApp() {
	log("🚫	退出应用");
	// 连续点击返回键多次以确保完全退出
	for (let i = 0; i < 5; i++) {
		back();
		sleepWithLog(500);
	}
	exit();
}

function getRoomName() {
	let userName = id("user_name").findOne(FIND_TIMEOUT);
	if (!userName) {
		return "NOT_FOUND";
	}
	return userName.text();
}

// main
// 等待开启无障碍权限
auto.waitFor();
const screenWidth = hamibot.env.screenWidth || 1080;
const screenHeight = hamibot.env.screenHeight || 2376;
log(`⚙️	屏幕宽度:${screenWidth},高度:${screenHeight}`);
setScreenMetrics(screenWidth, screenHeight);
const isDebug = hamibot.env.isDebug === undefined ? true : hamibot.env.isDebug;
const PRIZE_PRICE_MIN = hamibot.env.PRIZE_PRICE_MIN || 600;
const MAX_WAIT_TIME = hamibot.env.MAX_WAIT_TIME || 300;
const MAX_SWIPE_TIMES = hamibot.env.MAX_SWIPE_TIMES || 20; // 无效滑动次数,达到这个值后会重新进入直播间
const [NIGHT_START_HOUR, NIGHT_END_HOUR] = (hamibot.env.START_END_HOUR || "2-6")
	.split("-")
	.map(Number);

if (isDebug) {
	console.show();
	sleepWithLog(5000);
	console.setSize(
		Math.floor(screenWidth * 0.5),
		Math.floor(screenWidth * 0.6)
	);
	console.setPosition(0, Math.floor(screenHeight * 0.14));
}
// 📝📝📝📝📝分辨率不一样可能需要配置以下内容
const FUDAI_COLOR = colors.rgb(248, 158, 186);
const FUDAI_POS = [36, 360, 600, 468]; // 福袋按钮区域
const COUNTDOWN_POS = [0, 1083, 1080, 1662]; // 倒计时区域
const POPUP_POS = [0, 800, 1080, 2376]; // 弹窗区域
const PRIZE_POS = [48, 1335, 1032, 1779]; // 奖品参考价值区域
const JOINED_POS = [48, 2112, 1032, 2376];
const TOP_LIST_POS = [0, 120, 1080, 252]; // 顶部列表
const ENTER_LIVE_POS = [120, 400]; // 进入直播间坐标
const TOP_LIST_SWIPE = [750, 180, 200, 180, 2000]; //滑动顶部列表坐标,2000是滑动时长，单位毫秒
const FOLLOW_LIST_SWIPE = [280, 432, 800, 432, 2000]; // 关注列表滑动更新坐标,2000是滑动时长，单位毫秒
const MAX_RETRY = 3; // 查找福袋重试次数
const FIND_TIMEOUT = 2000;
const SLEEP_DURATION = 2000;

enterLiveRoom();
let swipeTimes = 0; // 无效滑动次数
let joinFailureTimes = 0; // 检测到福袋但是参与抽奖失败次数
let lastRoom = "NO_SET";
sleep(10000);
while (true) {
	clickPopup();
	log(`🔄	无效滑动次数:${swipeTimes}`);
	if (swipeTimes > MAX_SWIPE_TIMES) {
		log(`🔄	无效滑动次数超:${MAX_SWIPE_TIMES}次,重新进入直播间`);
		back();
		enterLiveRoom();
		swipeTimes = 0;
	}

	let now = new Date();
	log(`⏰ 当前时间:${now.getHours()}:${now.getMinutes()}`);
	if (
		now.getHours() >= NIGHT_START_HOUR &&
		now.getHours() <= NIGHT_END_HOUR
	) {
		exitApp();
		break;
	}

	let room = getRoomName();
	log(`🏠 当前直播间:${room},上一个直播间:${lastRoom}`);
	lastRoom = room;

	let fudai = search_fudai();
	let tryCount = 1;

	while (!fudai && tryCount < MAX_RETRY) {
		tryCount++;
		log(`👀	未找到福袋，重试第${tryCount}次`);
		fudai = search_fudai();
	}

	if (fudai) {
		if (fudai.prizePrice < PRIZE_PRICE_MIN) {
			log(`📤	奖品价值小于:${PRIZE_PRICE_MIN},划走`);
			swipeTimes += 1;
			swipUpWithLog();
			continue;
		}
		if (fudai.lastCountdown > MAX_WAIT_TIME) {
			log(`📤	倒计时大于:${MAX_WAIT_TIME}秒,划走`);
			swipeTimes += 1;
			swipUpWithLog();
			continue;
		}

		clickWithLog(fudai.x, fudai.y, "🎁	点击福袋");
		// 查看是否成功参与抽奖
		let success = boundsInside(
			JOINED_POS[0],
			JOINED_POS[1],
			JOINED_POS[2],
			JOINED_POS[3]
		)
			.className("com.lynx.tasm.behavior.ui.text.FlattenUIText")
			.textMatches(".*参与成功.*|.*等待开奖.*")
			.exists();

		clickPopup();

		if (success) {
			log(`🎉	抽奖成功,等待:${fudai.lastCountdown}秒`);
			swipeTimes = 0;
			joinFailureTimes = 0;
			lastRoom = "NO_SET";
			sleep(fudai.lastCountdown * 1000);
		} else {
			log("😥	检测到福袋,但参与抽奖失败");
			swipeTimes += 1;
			joinFailureTimes += 1;
			if (joinFailureTimes >= MAX_RETRY) {
				joinFailureTimes = 0;
				swipUpWithLog();
			}
		}
	} else {
		log("😥	未找到福袋,划走");
		swipeTimes += 1;
		swipUpWithLog();
	}
}
