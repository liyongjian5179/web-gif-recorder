#!/bin/bash
# Web GIF Recorder - 网站动图录制工具
# 版本: 2.0.0
# 支持长短选项参数，提供更友好的使用体验

# 默认配置
DEFAULT_URL="https://liyongjian.top/"
DEFAULT_DURATION=15
DEFAULT_DEVICE="pc"
DEFAULT_FPS=15
# 默认使用高质量（锐化 3.0）
DEFAULT_NO_CLEANUP=false

# 初始化变量
URL="$DEFAULT_URL"
DURATION="$DEFAULT_DURATION"
DEVICE="$DEFAULT_DEVICE"
FPS="$DEFAULT_FPS"
WIDTH=""
HEIGHT=""
PARAMS=""
ACTIONS=""
QUALITY="high"
DPI=""
FORMAT="gif"
FILENAME=""
NO_CLEANUP="$DEFAULT_NO_CLEANUP"

# 显示帮助信息
show_help() {
    cat << EOF
Web GIF Recorder - 网站动图录制工具

用法:
  ./record.sh [选项]

必选参数:
  -u, --url <url>           网站 URL (默认: $DEFAULT_URL)

可选参数:
  -d, --duration <seconds>  录制时长: 1-60 秒 (默认: $DEFAULT_DURATION)
  -m, --mobile              移动端模式 (等同于 --device mobile)
      --device <type>       设备类型: pc 或 mobile (默认: $DEFAULT_DEVICE)
  -f, --fps <number>        帧率: 5-30 FPS (默认: $DEFAULT_FPS)
  -q, --quality <level>     质量级别: ultra/high/medium/low (默认: $QUALITY)
      --dpi <number>        截图 DPI 倍率: 1-3 (默认: ultra=2, 其它=1)
      --format <type>       输出格式: gif 或 mp4 (默认: gif)
      --width <number>      视口宽度 (默认: PC=1280, Mobile=375)
      --height <number>     视口高度 (默认: PC=720, Mobile=667)
       --params <string>     URL 参数: lang:en,theme:dark
       --actions <string>    页面操作: click:#button,wait:1000
       --filename <name>     自定义文件名（不含扩展名）
       --no-cleanup          不清理临时文件
  -h, --help                显示此帮助信息
  -v, --version             显示版本信息

位置参数 (向后兼容):
  ./record.sh <URL> [DURATION] [DEVICE] [PARAMS] [ACTIONS] [NO_CLEANUP] [FILENAME]

使用示例:
  # 基本录制
  ./record.sh
  ./record.sh --url https://example.com
  ./record.sh -u https://example.com

  # 指定时长和设备
  ./record.sh -u https://example.com -d 20
  ./record.sh -u https://example.com --duration 20 --device mobile
  ./record.sh -u https://example.com -d 20 -m

  # 自定义分辨率
  ./record.sh -u https://example.com --width 1920 --height 1080

  # 高质量录制
  ./record.sh -u https://example.com --fps 30

  # 带URL参数和操作
  ./record.sh -u https://example.com --params "lang:en,theme:dark"
  ./record.sh -u https://example.com --actions "scroll:500,click:#button"

  # 自定义文件名
  ./record.sh -u https://example.com --filename my-recording

  # 调试模式（保留临时文件）
  ./record.sh -u https://example.com --no-cleanup

  # 向后兼容（位置参数）
  ./record.sh https://example.com 20 mobile "lang:en" "" false my-recording

EOF
}

# 显示版本信息
show_version() {
    cat << EOF
Web GIF Recorder v2.0.0
一个基于 Node.js 和 Puppeteer 的网站动图录制工具

项目地址: https://github.com/liyongjian5179/web-gif-recorder
文档: README.md, USAGE.md

EOF
}

# 参数验证函数
validate_url() {
    if [ -z "$1" ]; then
        echo "❌ 错误: URL 不能为空"
        return 1
    fi
    
    # 基本 URL 格式验证
    if [[ ! "$1" =~ ^https?:// ]]; then
        echo "❌ 错误: URL 必须以 http:// 或 https:// 开头"
        return 1
    fi
    
    return 0
}

validate_number() {
    local value="$1"
    local name="$2"
    local min="$3"
    local max="$4"
    
    if [ -z "$value" ]; then
        echo "❌ 错误: $name 不能为空"
        return 1
    fi
    
    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        echo "❌ 错误: $name 必须是数字"
        return 1
    fi
    
    if [ "$value" -lt "$min" ] || [ "$value" -gt "$max" ]; then
        echo "❌ 错误: $name 必须在 $min 到 $max 之间"
        return 1
    fi
    
    return 0
}

validate_device() {
    local device="$1"
    if [ "$device" != "pc" ] && [ "$device" != "mobile" ]; then
        echo "❌ 错误: 设备类型必须是 'pc' 或 'mobile'"
        return 1
    fi
    return 0
}

validate_quality() {
    local quality="$1"
    case "$quality" in
        ultra|high|medium|low)
            return 0
            ;;
        *)
            echo "❌ 错误: 质量级别必须是 'ultra', 'high', 'medium' 或 'low'"
            return 1
            ;;
    esac
}

validate_dpi() {
    local dpi="$1"
    if [ -z "$dpi" ]; then
        return 0
    fi
    if ! [[ "$dpi" =~ ^[1-3]$ ]]; then
        echo "❌ 错误: DPI 必须是 1-3 的整数"
        return 1
    fi
    return 0
}

validate_format() {
    local fmt="$1"
    if [ "$fmt" != "gif" ] && [ "$fmt" != "mp4" ]; then
        echo "❌ 错误: 输出格式必须是 'gif' 或 'mp4'"
        return 1
    fi
    return 0
}

# 解析选项参数
parse_options() {
    # 检查是否使用位置参数（向后兼容）
    if [ $# -eq 0 ]; then
        return 0
    fi
    
    # 如果第一个参数不是以 - 开头，使用位置参数模式
    if [[ ! "$1" =~ ^- ]]; then
        parse_positional_args "$@"
        return $?
    fi
    
    # 特殊处理帮助和版本（在解析前检查）
    for arg in "$@"; do
        case "$arg" in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                show_version
                exit 0
                ;;
        esac
    done
    
    # 使用 getopts 解析选项
    local OPTIND=1
    local opt

    while getopts ":u:d:f:q:mv-:" opt; do
        case "$opt" in
            u)
                URL="$OPTARG"
                ;;
            d)
                DURATION="$OPTARG"
                ;;
            f)
                FPS="$OPTARG"
                ;;
            q)
                QUALITY="$OPTARG"
                ;;
            m)
                DEVICE="mobile"
                ;;
            v)
                show_version
                exit 0
                ;;
            -)
                # 长选项处理
                case "$OPTARG" in
                    url)
                        URL="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    duration)
                        DURATION="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    mobile)
                        DEVICE="mobile"
                        ;;
                    device)
                        DEVICE="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    fps)
                        FPS="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    quality)
                        QUALITY="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    dpi)
                        DPI="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    format)
                        FORMAT="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    width)
                        WIDTH="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    height)
                        HEIGHT="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    params)
                        PARAMS="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    actions)
                        ACTIONS="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    filename)
                        FILENAME="${!OPTIND}"
                        OPTIND=$((OPTIND + 1))
                        ;;
                    no-cleanup)
                        NO_CLEANUP="true"
                        ;;
                    help)
                        show_help
                        exit 0
                        ;;
                    version)
                        show_version
                        exit 0
                        ;;
                    *)
                        echo "❌ 未知选项: --$OPTARG"
                        show_help
                        exit 1
                        ;;
                esac
                ;;
            \?)
                echo "❌ 未知选项: -$OPTARG"
                show_help
                exit 1
                ;;
            :)
                echo "❌ 选项 -$OPTARG 需要参数"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 移除已处理的选项参数
    shift $((OPTIND - 1))
    
    # 如果还有剩余参数，可能是位置参数（向后兼容）
    if [ $# -gt 0 ]; then
        parse_positional_args "$@"
    fi
    
    return 0
}

# 解析位置参数（向后兼容）
parse_positional_args() {
    URL=${1:-"$DEFAULT_URL"}
    DURATION=${2:-"$DEFAULT_DURATION"}
    DEVICE=${3:-"$DEFAULT_DEVICE"}
    PARAMS=${4:-""}
    ACTIONS=${5:-""}
    NO_CLEANUP=${6:-"$DEFAULT_NO_CLEANUP"}
    FILENAME=${7:-""}
}

# 设置默认分辨率
set_default_resolution() {
    if [ -n "$WIDTH" ] && [ -n "$HEIGHT" ]; then
        # 用户指定了分辨率，使用用户指定的值
        return
    fi
    
    if [ "$DEVICE" = "mobile" ]; then
        WIDTH=${WIDTH:-375}
        HEIGHT=${HEIGHT:-667}
    else
        WIDTH=${WIDTH:-1280}
        HEIGHT=${HEIGHT:-720}
    fi
}

# 显示配置信息
show_config() {
    echo "🚀 开始录制: $URL"
    echo "⏱️  时长: ${DURATION}秒"
    echo "📊 帧率: ${FPS} FPS"
    echo "📐 分辨率: ${WIDTH}x${HEIGHT}"
    echo "📱 设备: ${DEVICE}"
    echo "🔧 质量: ${QUALITY}"
    echo "🎥 格式: ${FORMAT}"
    if [ -n "$DPI" ]; then
        echo "🔍 DPI: ${DPI}x"
    fi
    
    if [ -n "$PARAMS" ]; then
        echo "🔧 参数: $PARAMS"
    fi
    if [ -n "$ACTIONS" ]; then
        echo "🎬 操作: $ACTIONS"
    fi
    if [ -n "$FILENAME" ]; then
        echo "📁 文件名: $FILENAME"
    fi
    if [ "$NO_CLEANUP" = "true" ]; then
        echo "⚠️  调试模式：保留临时文件"
    fi
    echo ""
}

# 主函数
main() {
    # 解析参数
    parse_options "$@"
    
    # 参数验证
    validate_url "$URL" || exit 1
    validate_number "$DURATION" "时长" 1 60 || exit 1
    validate_number "$FPS" "帧率" 5 30 || exit 1
    validate_device "$DEVICE" || exit 1
    validate_quality "$QUALITY" || exit 1
    validate_dpi "$DPI" || exit 1
    validate_format "$FORMAT" || exit 1
    
    # 设置默认分辨率
    set_default_resolution
    
    # 验证分辨率
    validate_number "$WIDTH" "宽度" 320 3840 || exit 1
    validate_number "$HEIGHT" "高度" 240 2160 || exit 1
    
    # 构建命令参数
    CMD_ARGS=("--url" "$URL" "--duration" "$DURATION" "--device" "$DEVICE" "--fps" "$FPS" "--width" "$WIDTH" "--height" "$HEIGHT" "--quality" "$QUALITY" "--format" "$FORMAT")
    
    if [ -n "$DPI" ]; then
        CMD_ARGS+=("--dpi" "$DPI")
    fi

    if [ -n "$PARAMS" ]; then
        CMD_ARGS+=("--params" "$PARAMS")
    fi
    
    if [ -n "$ACTIONS" ]; then
        CMD_ARGS+=("--actions" "$ACTIONS")
    fi
    
    if [ "$NO_CLEANUP" = "true" ]; then
        CMD_ARGS+=("--no-cleanup" "true")
    fi
    
    if [ -n "$FILENAME" ]; then
        CMD_ARGS+=("--filename" "$FILENAME")
    fi
    
    # 执行录制 (由 Node.js 负责所有输出)
    node examples/record-gif.js "${CMD_ARGS[@]}"
    
    # 返回 Node.js 进程的退出码
    exit $?
}

# 执行主函数
main "$@"
