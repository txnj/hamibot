import datetime
import os
import re
import subprocess
import sys
import time

from PIL import Image, ImageDraw

from utils.image import calculate_similarity_histogram
from utils.ocr import umi_ocr
from utils.sleep import interruptible_sleep


class Fudai:
    # 类常量定义
    FUDAI_AREA = "fudai_area"  # 福袋区域截图文件名
    PRIZE_AREA = "prize_area"  # 奖品区域截图文件名
    JOIN_AREA = "join_area"  # 参与抽奖区域截图文件名
    POPUP_AREA = "popup_area"  # 弹窗区域截图文件名
    ENTER_AREA = "enter_area"  # 重新进入直播间区域截图文件名
    FUDAI_TEMPLATE1 = "fudai_template1"  # 福袋图片
    PRIZE_MIN_VALUE = 600  # 奖品最小参考价值,低于此值则不参与抽奖
    MAX_WAIT_TIME = 300  # 最大等待开奖时间(秒),超过此值则切换直播间
    SLEEP_SECONDS = 0.5  # 休眠时间
    ROOM_AREA = "room_area"  # 直播间名称区域截图文件名
    MAX_SWIPE_TIMES = 45  # 最无效大滑动次数
    SWIPE_SLEEP_TIME = 900  # MAX_SWIPE_TIMES达到后,休眠时间(秒)
    MAX_IDLE_TIME = 3600  # 最大空闲时间(秒),在这个时一直都未检测到福袋,退出应用
    NIGHT_START_HOUR = 2  # 夜间大于这个时间,则退出应用
    NIGHT_END_HOUR = 6  # 夜间小于这个时间,则退出应用
    SIMILARITY_THRESHOLD = 0.85  # 福袋图片相似度阈值,低于此值则不参与抽奖

    FUDAI_LT_POS = (30, 360)
    FUDAI_RB_POS = (460, 666)
    PRIZE_LT_POS = (400, 1500)
    PRIZE_RB_POS = (800, 1750)
    JOIN_LT_POS = (60, 2111)
    JOIN_RB_POS = (1000, 2314)
    POPUP_LT_POS = (150, 700)
    POPUP_RB_POS = (900, 1414)
    ROOM_LT_POS = (140, 150)
    ROOM_RB_POS = (333, 244)
    ENTER_LT_POS = (30, 300)  # 进入直播间
    ENTER_RB_POS = (730, 555)

    def __init__(
        self,
        device_id: str,
        prize_min_value: int,
        defbug=False,
        switch=False,
        resolution_x=1080,
        resolution_y=2376,
    ):
        self.debug = defbug
        self.switch = switch  # 是否切换直播间
        if device_id:
            self.device_id = device_id
        else:
            self.device_id = self.list_device_id()[0]

        self.prize_min_value = (
            prize_min_value if prize_min_value else self.PRIZE_MIN_VALUE
        )

        self.base_path = os.path.join(
            os.path.expanduser("~"), "douyin", self.device_id.replace(":", "_")
        )
        # resolution_x和resolution_y滑动的时候用,不同分辨率手机不影响,主要设置下面的pos定位
        self.resolution_x = resolution_x
        self.resolution_y = resolution_y
        self.swipe_duration = True  # True: 向上滑动, False: 向下滑动

        self.fudai_lt_pos = self.FUDAI_LT_POS
        self.fudai_rb_pos = self.FUDAI_RB_POS
        self.prize_lt_pos = self.PRIZE_LT_POS
        self.prize_rb_pos = self.PRIZE_RB_POS
        self.join_lt_pos = self.JOIN_LT_POS
        self.join_rb_pos = self.JOIN_RB_POS
        self.popup_lt_pos = self.POPUP_LT_POS
        self.popup_rb_pos = self.POPUP_RB_POS
        self.room_lt_pos = self.ROOM_LT_POS
        self.room_rb_pos = self.ROOM_RB_POS
        self.enter_lt_pos = self.ENTER_LT_POS
        self.enter_rb_pos = self.ENTER_RB_POS

        self.last_prize_value = 0
        self.room = ""
        self.last_fudai_ts = self.timestamp()
        self.last_countdown = 0

        # 正则表达式
        self.prize_value_re = re.compile(r"参考价值\s*[:：]\s*￥(\d+)")  # 奖品参考价值
        self.countdown_re = re.compile(r"\d{2}:\d{2}")  # 倒计时
        self.battery_re = re.compile(r"level:\s*(\d+)")  # 电量
        self.join_re = re.compile(r"一键|发表评论")  # 点击参与抽奖
        self.joined_re = re.compile(r"等待开奖")  # 已经参与抽奖
        self.popup_re = re.compile(r"我知道了|领取奖品")  # 弹窗内容
        self.enter_re = re.compile(r"直播中")  # 重新进入直播间

    def timestamp(self):
        """获取当前时间戳"""
        return int(time.time())

    def get_screenshot(self, save_name="screenshot"):
        """截图需要大约2秒钟:
        1. 在设备上截取屏幕并保存为PNG文件。
        2. 将截图从设备拉取到本地路径。
        """
        # 构建完整路径
        path = os.path.join(self.base_path, f"{save_name}.png")

        # 确保目录存在
        os.makedirs(self.base_path, exist_ok=True)

        screenshot_path = "/sdcard/DCIM/screenshot.png"

        try:
            # 添加超时处理
            subprocess.run(
                f"adb -s {self.device_id} shell screencap -p {screenshot_path}",
                shell=True,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,  # 添加超时时间
            )
            # 将截图从设备拉取到本地路径
            subprocess.run(
                f"adb -s {self.device_id} pull {screenshot_path} {path}",
                shell=True,
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print("📱 手机截屏成功")
            return True

        except subprocess.TimeoutExpired:
            print("💊 截图超时")
            return False
        except subprocess.CalledProcessError as e:
            print(f"💊 adb截屏失败: {e}")
            return False

    def cut_image(
        self,
        left_top=(0, 63),
        right_bottom=(1080, 1620),
        name="",
    ):
        """裁剪截图，获取需要的小图片方便识别
        Args:
            left_top: 裁剪起始坐标
            right_bottom: 裁剪结束坐标
            target: 目标文件夹名称
            name: 输出文件名(不含扩展名)
            resolution: 目标分辨率
        """
        # 坐标
        scaled_left_top = (int(left_top[0]), int(left_top[1]))
        scaled_right_down = (int(right_bottom[0]), int(right_bottom[1]))
        path = self.base_path

        # 构建输入输出路径
        screenshot_path = os.path.join(path, "screenshot.png")
        cut_pic_path = os.path.join(path, f"{name if name else 'cut'}.png")

        try:
            # 打开并裁剪图片
            with Image.open(screenshot_path) as img:
                img.crop((*scaled_left_top, *scaled_right_down)).save(cut_pic_path)
            return True
        except Exception as e:
            print(f"💊 裁剪图片时出错: {e}")
            return False

    def extract_text_from_image(self, picname="", data_fmt="dict"):
        """识别图像中的文字"""
        # 构建图片路径
        pic_path = os.path.join(
            self.base_path,
            f"{picname if picname else 'cut'}.png",
        )
        # 使用OCR识别文字并去除空格和换行符
        return umi_ocr(pic_path, data_fmt)

    def list_device_id(self):
        """获取连接的安卓设备ID"""
        try:
            result = subprocess.check_output(["adb", "devices"]).decode("utf-8")
            devices = [
                line.split()[0] for line in result.splitlines()[1:] if line.strip()
            ]
            if not devices:
                raise Exception("没有找到已连接的设备")

            for device in devices:
                print(device)

            return devices
        except Exception as e:
            print(f"获取设备ID失败: {e}")
            sys.exit(1)

    def get_battery_level(self):
        """获取设备电量信息

        Returns:
            int: 当前电池电量百分比(0-100)
        """
        # 执行adb命令获取电池信息
        battery_info = subprocess.Popen(
            f"adb -s {self.device_id} shell dumpsys battery",
            shell=True,
            stdout=subprocess.PIPE,
        )
        battery_info_string = battery_info.stdout.read().decode("utf-8")

        # 使用正则表达式直接提取电量值
        match = self.battery_re.search(battery_info_string)
        if not match:
            raise ValueError("无法获取电池电量信息")

        battery_level = int(match.group(1))
        print(f"{('🔋' if battery_level>10 else '🪫')} 设备当前电量为:{battery_level}%")
        return battery_level

    def get_prize_value(self) -> int:
        """获取奖品参考价值"""

        if not self.cut_image(
            self.prize_lt_pos,  # 左上角坐标
            self.prize_rb_pos,  # 右下角坐标
            self.PRIZE_AREA,  # 保存的截图名称
        ):
            return 0

        result = self.extract_text_from_image(self.PRIZE_AREA, data_fmt="text")

        if result is not None:
            matched = self.prize_value_re.search(result)
            if matched:
                value = int(matched.group(1))
                print(f"💴 奖品参考价值: {value}")
                return value

        return 0

    def time_to_seconds(self, time_str: str) -> int:
        """将时间字符串(MM:SS格式)转换为秒数
        Args:
            time_str: 时间字符串,格式为"MM:SS"

        Returns:
            int: 转换后的秒数
        """
        minutes, seconds = map(int, time_str.split(":"))
        return minutes * 60 + seconds

    def back(self, times=1):
        """模拟点击返回按钮"""
        for _ in range(times):
            os.system(f"adb -s {self.device_id} shell input keyevent KEYCODE_BACK")
        self.sleep()

    def click_blank_area(self):
        """模拟点击空白区域"""
        self.tap(720, 540, "🌥️  点击空白区域")

    def click_popup(self, re=None, lt_pos=POPUP_LT_POS, rb_pos=POPUP_RB_POS):
        """模拟点击弹出窗"""

        if not re:
            re = self.popup_re

        if not self.cut_image(
            lt_pos,  # 左上角坐标
            rb_pos,  # 右下角坐标
            self.POPUP_AREA,  # 保存的截图名称
        ):
            return

        result = self.extract_text_from_image(self.POPUP_AREA, data_fmt="dict")

        if not result:
            return

        for item in result:
            matched = re.search(item["text"])
            if matched:
                matched_text = matched.group()
                if matched_text == "领取奖品":
                    self.get_screenshot(save_name=f"中奖_{self.timestamp()}")
                print(f"🍾 弹窗识别内容:{matched_text}")
                x1, y1 = item["box"][0][0], item["box"][0][1]  # 左上角坐标
                x2, y2 = item["box"][2][0], item["box"][2][1]  # 右下角坐标
                mid_xy = ((x1 + x2) // 2, (y1 + y2) // 2)
                pos = (
                    lt_pos[0] + mid_xy[0],
                    lt_pos[1] + mid_xy[1],
                )
                if self.debug:
                    self.mark_position(pos, "marked_popup_pos")

                self.tap(pos[0], pos[1], "🍾 关闭弹窗")
                if matched_text == "领取奖品":
                    self.get_screenshot(save_name=f"领奖_{self.timestamp()}")
                break

    def tap(self, x, y, msg="点击"):
        """模拟点击屏幕指定位置

        Args:
            x: 点击位置的x坐标
            y: 点击位置的y坐标
        """
        os.system(f"adb -s {self.device_id} shell input tap {x} {y}")
        print(f"{msg}: ({x}, {y})")
        self.sleep()
        self.get_screenshot()

    def mark_position(self, pos, marked_name="marked_screenshot", radius=40):
        """在截图上标记位置

        Args:
            pos: 要标记的坐标元组 (x, y)
            radius: 圆圈半径,默认20
        """
        img_path = os.path.join(self.base_path, "screenshot.png")
        with Image.open(img_path) as img:
            draw = ImageDraw.Draw(img)
            draw.ellipse(
                [
                    pos[0] - radius,
                    pos[1] - radius,
                    pos[0] + radius,
                    pos[1] + radius,
                ],
                outline="red",
                width=3,
            )
            img.save(os.path.join(self.base_path, f"{marked_name}.png"))

    def enter_room(self):
        """进入直播间"""
        self.get_screenshot()
        if not self.cut_image(
            self.enter_lt_pos,  # 左上角坐标
            self.enter_rb_pos,  # 右下角坐标
            self.ENTER_AREA,  # 保存的截图名称
        ):
            return

        result = self.extract_text_from_image(self.ENTER_AREA, data_fmt="dict")

        if not result:
            return

        for item in result:
            matched = self.enter_re.search(item["text"])
            if matched:
                x1, y1 = item["box"][0][0], item["box"][0][1]  # 左上角坐标
                x2, y2 = item["box"][2][0], item["box"][2][1]  # 右下角坐标
                mid_xy = ((x1 + x2) // 2, (y1 + y2) // 2)
                pos = (
                    self.enter_lt_pos[0] + mid_xy[0],
                    self.enter_lt_pos[1] + mid_xy[1] - 20,
                )

                self.tap(pos[0], pos[1], "🎞️ 进入直播间")
                break

    def calc_fudai_similarity(self, pos: tuple):
        """计算福袋图片相似度"""

        pos1 = (pos[0] - 40, pos[1] - 30)
        pos2 = (pos[0] + 32, pos[1] + 21)

        return calculate_similarity_histogram(
            os.path.join(self.base_path, "screenshot.png"),
            os.path.join(self.base_path, f"{self.FUDAI_TEMPLATE1}.png"),
            pos1 + pos2,
        )

    def get_fudai_pos(self):
        """检测直播页面是否存在福袋图标

        orc识别福袋区域倒计时,确定福袋是否存在。
        失败最多重试2次。每次等待5秒

        Returns:
            int | False: 如果找到福袋,返回其x坐标;否则返回False
        """

        # 关闭弹窗
        self.click_popup()
        self.click_popup()
        # 点击空白区域
        self.click_blank_area()
        # 截图福袋区域
        self.cut_image(
            self.fudai_lt_pos,  # 左上角坐标
            self.fudai_rb_pos,  # 右下角坐标
            self.FUDAI_AREA,  # 保存的截图名称
        )

        # 识别福袋区域
        result = self.extract_text_from_image(self.FUDAI_AREA)

        if not result:
            return None
        # 获取福袋坐标
        for item in result:
            matched = self.countdown_re.search(item["text"])
            if matched:
                # 使用OCR识别到的坐标画框
                x1, y1 = item["box"][0][0], item["box"][0][1]  # 左上角坐标
                x2, y2 = item["box"][2][0], item["box"][2][1]  # 右下角坐标
                mid_xy = ((x1 + x2) // 2, (y1 + y2) // 2)
                pos = (
                    self.fudai_lt_pos[0] + mid_xy[0],
                    self.fudai_lt_pos[1] + mid_xy[1] - 30,
                )

                similarity_score = self.calc_fudai_similarity(pos)
                print(f"🎯 福袋相似度得分:{similarity_score}")
                if similarity_score < self.SIMILARITY_THRESHOLD:
                    print(f"🎯 福袋相似度低于{self.SIMILARITY_THRESHOLD},不参与抽奖")
                    continue

                # 点击福袋位置
                self.tap(pos[0], pos[1], "🎁 点击福袋")

                # 在调试模式下才标记福袋位置
                if self.debug:
                    print("🐞 debug")
                    self.mark_position(pos, "marked_fudai_pos", radius=60)
                else:
                    pass

                prize_value = self.get_prize_value()
                if prize_value < self.prize_min_value:
                    print(f"😎 奖品参考价值低于:{self.prize_min_value},不参与抽奖")
                    self.click_blank_area()
                    continue

                if self.join_fudai():
                    self.last_countdown = self.time_to_seconds(matched.group())
                    self.last_fudai_ts = self.timestamp()
                    return pos

        return None

    def join_fudai(self) -> bool:
        """参与抽奖"""
        self.cut_image(
            self.join_lt_pos,  # 左上角坐标
            self.join_rb_pos,  # 右下角坐标
            self.JOIN_AREA,  # 保存的截图名称
        )

        result = self.extract_text_from_image(self.JOIN_AREA, data_fmt="dict")

        for item in result:
            matched_joined = self.joined_re.search(item["text"])
            if matched_joined:
                print("🎉 已参与抽奖")
                self.click_blank_area()
                return True
            matched_join = self.join_re.search(item["text"])
            if matched_join:
                x1, y1 = item["box"][0][0], item["box"][0][1]  # 左上角坐标
                x2, y2 = item["box"][2][0], item["box"][2][1]  # 右下角坐标
                mid_xy = ((x1 + x2) // 2, (y1 + y2) // 2)
                pos = (
                    self.join_lt_pos[0] + mid_xy[0],
                    self.join_lt_pos[1] + mid_xy[1],
                )

                self.tap(pos[0], pos[1], "🍀 点击参加抽奖")
                return True

        return False

    def get_live_room_name(self):
        self.cut_image(self.room_lt_pos, self.room_rb_pos, self.ROOM_AREA)
        result = self.extract_text_from_image(self.ROOM_AREA, data_fmt="text")
        if result:
            result = result.replace(" ", "").replace("\n", "")
            if len(result) >= 4:
                return result[:4]
            else:
                return result
        else:
            return "NOT_FOUND"

    def swipe(self, start_x, start_y, end_x, end_y, duration=100):
        """模拟滑动操作

        Args:
            start_x: 起始点x坐标
            start_y: 起始点y坐标
            end_x: 结束点x坐标
            end_y: 结束点y坐标
            duration: 滑动持续时间(毫秒)
        """
        cmd = f"adb -s {self.device_id} shell input swipe {start_x} {start_y} {end_x} {end_y} {duration}"
        os.system(cmd)
        self.sleep()

    def swipe_up(self):
        """向上滑动(切换到下一个视频)"""
        start_y = int(self.resolution_y * 0.5)  # 屏幕下方 x% 位置
        end_y = int(self.resolution_y * 0.4)  # 屏幕上方 x% 位置
        center_x = self.resolution_x // 2  # 屏幕中间
        self.swipe(center_x, start_y, center_x, end_y)

    def swipe_down(self):
        """向下滑动(回到上一个视频)"""
        start_y = int(self.resolution_y * 0.5)  # 屏幕上方 x% 位置
        end_y = int(self.resolution_y * 0.6)  # 屏幕下方 x% 位置
        center_x = self.resolution_x // 2  # 屏幕中间
        self.swipe(center_x, start_y, center_x, end_y)

    def swipe_by_duration(self):
        if self.swipe_duration:
            self.swipe_up()
        else:
            self.swipe_down()

        self.sleep(9)

    def sleep(self, seconds=SLEEP_SECONDS):
        """执行标准休眠"""
        print(f"💤 休眠{seconds}秒")
        time.sleep(seconds)

    def choujiang(self):
        swipe_times = 0
        while True:
            print(f"🔄 无效滑动次数:{swipe_times}")
            if swipe_times > self.MAX_SWIPE_TIMES:
                print(
                    f"💤 无效滑动次数超过{self.MAX_SWIPE_TIMES}次,休眠{self.SWIPE_SLEEP_TIME}秒"
                )
                interruptible_sleep(self.SWIPE_SLEEP_TIME)
                swipe_times = 0

            if swipe_times > self.MAX_SWIPE_TIMES / 3:
                print("🔄 无效滑动次数超过1/3,重新进入直播间")
                self.back()
                self.enter_room()

            hour = datetime.datetime.now().hour
            elapsed = self.timestamp() - self.last_fudai_ts
            print(f"🕒 hour:{hour},elapsed:{elapsed}")
            if (self.NIGHT_START_HOUR <= hour <= self.NIGHT_END_HOUR) or (
                elapsed > self.MAX_IDLE_TIME
            ):
                self.back(times=5)  # 模拟返回键多次退出应用
                print(f"⚠️hour:{hour},elapsed:{elapsed},退出抖音,停止抽奖")
                return

            self.get_screenshot()
            current_room = self.get_live_room_name()
            print(f"🏠 当前直播间:{current_room},上一个直播间:{self.room}")
            if current_room == self.room:
                print(
                    f"🔃 切换滑动方向:{'UP->DOWN' if self.swipe_duration else 'DOWN->UP'}"
                )
                self.swipe_duration = not self.swipe_duration
            else:
                self.room = current_room

            pos = self.get_fudai_pos()
            if not pos:
                print("↪️  未发现福袋,重试一次")
                pos = self.get_fudai_pos()  # 如果没找到,重试一次

            if pos:
                # 打开福袋详情页
                self.get_screenshot()
                similarity_score = self.calc_fudai_similarity(pos)
                print(f"🎯 福袋相似度得分:{similarity_score}")
                if similarity_score < self.SIMILARITY_THRESHOLD:
                    print(f"🎯 福袋相似度低于{self.SIMILARITY_THRESHOLD},重新检测")
                    self.room = "NOT_SET"
                    continue
                self.tap(pos[0], pos[1], "🎁 打开福袋详情页")
                joined = self.join_fudai()

                if joined:
                    if self.last_countdown < self.MAX_WAIT_TIME:
                        print(f"🕒 等待开奖: {self.last_countdown}s")
                        self.room = "NOT_SET"
                        swipe_times = 0
                        interruptible_sleep(self.last_countdown)
                    elif not self.switch:
                        print(
                            f"🕒 等待开奖,当前设置为不切换直播间: {self.last_countdown}s"
                        )
                        self.room = "NOT_SET"
                        swipe_times = 0
                        interruptible_sleep(self.last_countdown)
                    else:
                        print("💔 抢福袋时间未到,切换直播间")
                        swipe_times += 1
                        self.swipe_by_duration()
                else:
                    swipe_times += 1
                    if self.switch:
                        print("💔 参与抽奖失败,切换直播间")
                        self.swipe_by_duration()
                    else:
                        print("💔 参与抽奖失败,再次检测")
            else:
                swipe_times += 1
                if self.switch:
                    print("💔 未找到福袋,切换直播间")
                    self.swipe_by_duration()
                else:
                    print("💔 未找到福袋,再次检测")
                    self.sleep(9)

    def check_health(self):
        """检查运行环境是否健康"""
        # 检查电量
        if self.get_battery_level() < 10:
            self.back(times=5)  # 模拟返回键多次退出应用
            raise Exception("🪫 电量不足10%,停止运行")
        # 检查adb连接
        try:
            subprocess.run(
                f"adb -s {self.device_id} get-state",
                shell=True,
                check=True,
                capture_output=True,
            )
        except subprocess.CalledProcessError:
            self.back(times=5)  # 模拟返回键多次退出应用
            raise Exception("🔌 设备连接异常,停止运行")


if __name__ == "__main__":
    fudai = Fudai("192.168.123.13:5555", defbug=False, switch=True)
    fudai.get_battery_level()
    print(f"💰 奖品最小参考价值,大于此值才参与抽奖:{fudai.prize_min_value}")
    fudai.choujiang()
