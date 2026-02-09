# Web GIF Recorder - Agent Guidelines

## Project Overview
A Node.js tool for recording website animations and converting them to GIFs/MP4s using Puppeteer and FFmpeg. Written in JavaScript (CommonJS modules).

## Build/Lint/Test Commands

### Running the Application
```bash
# Run with default parameters
npm start

# Run test with specific URL
npm test

# Run development mode
npm dev
```

### Manual Testing
To manually test individual modules:
```bash
# Test recorder directly
node -e "const recorder = require('./src/recorder'); console.log('Recorder loaded successfully');"

# Test validator
node -e "const v = require('./src/utils/validator'); console.log(v.validateUrl('https://example.com'));"
```

## Code Style Guidelines

### Module System
- **CommonJS modules** (require/exports)
- No ES6 import/export syntax
- Each file exports a single class or function

### File Structure
```
src/
├── index.js              # Main entry point (recording only)
├── recorder.js           # Core recorder class
├── scroll-capture.js     # Scroll recording logic
├── gif-converter.js      # GIF/MP4 conversion logic
└── utils/
    ├── browser.js        # Puppeteer browser manager
    ├── file-manager.js   # File operations
    ├── param-parser.js   # URL/action parameter parsing
    └── validator.js      # Input validation

examples/
└── record-gif.js         # Recording feature (standalone)

Shell Scripts
└── record.sh             # Quick recording script (wrapper)
```

### Naming Conventions
- **Classes**: PascalCase (e.g., `WebGifRecorder`, `BrowserManager`)
- **Methods**: camelCase (e.g., `validateUrl`, `captureWithScroll`)
- **Variables**: camelCase (e.g., `screenshotPaths`, `durationSeconds`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_DURATION`, `DEFAULT_FPS`)

### Error Handling
- Use try-catch blocks for async operations
- Provide meaningful error messages in **Chinese**
- Include troubleshooting tips in error output

### Async/Await Pattern
- Always use `async/await` for Promise-based operations
- Avoid `.then()` chains

### Configuration
- Use default options in class constructors
- Merge user options with defaults

### Browser Automation Best Practices
- Always close browser instances in finally blocks
- Clear browser cache before recording
- Set appropriate timeouts
- Handle network idle states

### FFmpeg Usage
- Use two-step palette optimization for GIF quality
- **MP4 Support**: Use libx264 with high profile and even dimensions (macroblock alignment)
- Clean up temporary palette files

### Device Configuration
- Support PC and mobile device emulation
- **DPI Support**: Handle 1x, 2x, 3x DPI for Retina simulation
- Configure viewport, user agent, and touch capabilities

### Recording Strategy
- **Smart Detection**: Automatically detect page type (Long Page vs SPA/Fullpage).
- **Adaptive Rhythm**: Adjust scroll interval based on duration (1.2s - 2.0s).
- **Visual Feedback**: Use visual probing to detect scrollability and end-of-page.

### Output File Naming
- Include hostname, path, device type, and timestamp
- Sanitize special characters
- Example: `example_com_home_pc_2026-02-05T07_40_44_312Z.mp4`

## Important Notes for Agents
1. **Always use CommonJS** - No ES6 modules
2. **Write comments in Chinese** - Match existing codebase
3. **Use emojis in console output** - For visual clarity
4. **Handle errors gracefully** - Provide helpful error messages
5. **Close resources properly** - Always close browser instances
6. **Test with real URLs** - The project is designed for real websites
7. **Check FFmpeg installation** - Required for GIF/MP4 generation
8. **Respect parameter limits** - Duration: 1-60s, FPS: 5-30
9. **DPI Awareness**: When generating MP4, ensure output dimensions are even numbers (required by H.264).

## Version Information
- Project version: 1.1.0
- Node.js: 16+
- Puppeteer: ^21.0.0
- Fluent-ffmpeg: ^2.1.2

## License
MIT License
