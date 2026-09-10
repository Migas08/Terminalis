/* Use installed Edge on Windows, Playwright's managed browser elsewhere. */
module.exports = process.env.TERMINALIS_BROWSER ? {executablePath:process.env.TERMINALIS_BROWSER} : process.platform === 'win32' ? {channel:'msedge'} : {};
