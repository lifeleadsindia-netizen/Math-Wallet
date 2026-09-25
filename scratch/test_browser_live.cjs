const { spawn } = require('child_process');
const http = require('http');
const WebSocket = require('c:/xampp_lite_8_5/apps/apache/htdocs/math_wallet/node_modules/ws');
const { execSync } = require('child_process');

// 1. Get session cookie using our PHP script
const phpOutput = execSync('php scratch/test_http_login.php', { cwd: 'c:/xampp_lite_8_5/apps/apache/htdocs/math_wallet' }).toString();
const cookieMatch = phpOutput.match(/math-wallet-session\t([^\r\n]+)/);
if (!cookieMatch) {
    console.error('Failed to get session cookie');
    process.exit(1);
}
const sessionCookieVal = decodeURIComponent(cookieMatch[1]);
console.log('Got session cookie:', sessionCookieVal.substring(0, 30) + '...');

async function run() {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const profileDir = 'C:\\Users\\abhay\\.gemini\\antigravity-ide\\brain\\c5f6b82a-3f5b-4ad5-ab77-6b57ed29d6a6\\scratch\\cdp_profile_live';
    const chrome = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=9223',
        `--user-data-dir=${profileDir}`,
        '--disable-gpu',
        '--no-sandbox'
    ]);

    await new Promise(r => setTimeout(r, 2500));

    try {
        const newPageData = await new Promise((resolve, reject) => {
            const req = http.request('http://127.0.0.1:9223/json/new', { method: 'PUT' }, res => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(JSON.parse(data)));
            });
            req.on('error', reject);
            req.end();
        });

        const ws = new WebSocket(newPageData.webSocketDebuggerUrl);
        await new Promise(r => ws.on('open', r));

        let id = 1;
        function send(method, params = {}) {
            return new Promise(resolve => {
                const curId = id++;
                const handler = msg => {
                    const parsed = JSON.parse(msg);
                    if (parsed.id === curId) {
                        ws.off('message', handler);
                        resolve(parsed.result);
                    }
                };
                ws.on('message', handler);
                ws.send(JSON.stringify({ id: curId, method, params }));
            });
        }

        ws.on('message', msg => {
            const parsed = JSON.parse(msg);
            if (parsed.method === 'Runtime.consoleAPICalled') {
                console.log('[CONSOLE]', parsed.params.type, parsed.params.args.map(a => a.value || a.description).join(' '));
            } else if (parsed.method === 'Runtime.exceptionThrown') {
                console.log('[EXCEPTION]', parsed.params.exceptionDetails.text, parsed.params.exceptionDetails.exception?.description);
            }
        });

        await send('Runtime.enable');
        await send('Page.enable');
        await send('Network.enable');

        // Set Cookie
        await send('Network.setCookie', {
            name: 'math-wallet-session',
            value: sessionCookieVal,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true
        });

        async function testPage(url, pageName) {
            console.log(`\n=================== TESTING ${pageName} (${url}) ===================`);
            await send('Page.navigate', { url });
            await new Promise(r => setTimeout(r, 2000));

            const title = await send('Runtime.evaluate', { expression: 'document.title' });
            console.log('Page Title:', title.result.value);

            // Check if profile dropdown elements exist
            const checkElements = await send('Runtime.evaluate', {
                expression: `
                    JSON.stringify({
                        hasContainer: !!document.querySelector('.header-profile2'),
                        hasToggle: !!document.getElementById('headerProfileToggle'),
                        hasMenu: !!document.getElementById('headerProfileMenu'),
                        isToggleFnDefined: typeof window.toggleProfileDropdown === 'function',
                        isCloseFnDefined: typeof window.closeProfileDropdown === 'function'
                    })
                `
            });
            console.log('Elements check:', checkElements.result.value);

            // Test clicking the profile toggle
            const clickTest = await send('Runtime.evaluate', {
                expression: `
                    (function() {
                        const toggle = document.getElementById('headerProfileToggle') || document.querySelector('.header-profile2 a.nav-link');
                        const menu = document.getElementById('headerProfileMenu') || document.querySelector('.header-profile2 .dropdown-menu');
                        const img = document.querySelector('.header-profile2 img');

                        const beforeClick = {
                            menuDisplay: window.getComputedStyle(menu).display,
                            menuVisibility: window.getComputedStyle(menu).visibility,
                            menuOpacity: window.getComputedStyle(menu).opacity,
                            menuHasShow: menu.classList.contains('show'),
                            containerHasShow: toggle.closest('.header-profile2').classList.contains('show')
                        };

                        // Click the toggle / image
                        if (img) img.click(); else if (toggle) toggle.click();

                        const afterClick = {
                            menuDisplay: window.getComputedStyle(menu).display,
                            menuVisibility: window.getComputedStyle(menu).visibility,
                            menuOpacity: window.getComputedStyle(menu).opacity,
                            menuHasShow: menu.classList.contains('show'),
                            containerHasShow: toggle.closest('.header-profile2').classList.contains('show'),
                            menuRect: menu.getBoundingClientRect()
                        };

                        // Click outside (on body or content)
                        document.body.click();

                        const afterOutsideClick = {
                            menuDisplay: window.getComputedStyle(menu).display,
                            menuHasShow: menu.classList.contains('show')
                        };

                        return JSON.stringify({ beforeClick, afterClick, afterOutsideClick });
                    })()
                `
            });
            console.log('Click test result:', clickTest.result.value);
        }

        // Test Business Plan Text
        await testPage('http://127.0.0.1:8000/member/business-plan-text', 'BUSINESS PLAN TEXT');

        // Test Dashboard
        await testPage('http://127.0.0.1:8000/member/dashboard', 'DASHBOARD');

        // Test Withdrawal
        await testPage('http://127.0.0.1:8000/member/wallet/withdrawal', 'WALLET WITHDRAWAL');

        // Test Profile
        await testPage('http://127.0.0.1:8000/member/profile/profile', 'PROFILE');

        ws.close();
    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        chrome.kill();
    }
}

run();

        // Test mobile
        await testPage('http://127.0.0.1:8000/member/business-plan-text', 'BUSINESS PLAN TEXT', true);
        await testPage('http://127.0.0.1:8000/member/dashboard', 'DASHBOARD', true);

        ws.close();
    } catch (e) {
        console.error('Test error:', e);
    } finally {
        chrome.kill();
    }
}

run();
