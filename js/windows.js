export const WindowManager = {
    zIndex: 100,
    activeWindows: {},

    init() {
        this.container = document.getElementById('window-manager');
        this.taskbar = document.getElementById('running-apps');
    },

    open(module) {
        if (this.activeWindows[module.id]) {
            this.restore(module.id);
            this.focus(module.id);
            return;
        }

        const win = document.createElement('div');
        win.className = 'ciis-window';
        win.id = `win-${module.id}`;
        win.style.width = module.width || '600px';
        win.style.height = module.height || '400px';
        
        const offset = Object.keys(this.activeWindows).length * 30;
        win.style.top = `${50 + offset}px`;
        win.style.left = `${100 + offset}px`;
        win.style.zIndex = ++this.zIndex;

        win.innerHTML = `
            <div class="window-header">
                <span class="window-title">⬢ ${module.title}</span>
                <div class="window-controls">
                    <button class="win-btn btn-minimize"></button>
                    <button class="win-btn btn-maximize"></button>
                    <button class="win-btn btn-close"></button>
                </div>
            </div>
            <div class="window-content">${module.render()}</div>
        `;

        this.container.appendChild(win);
        this.activeWindows[module.id] = win;
        this.createTaskbarIcon(module);
        this.setupEvents(win, module.id);
        this.focus(module.id);
    },

    setupEvents(win, id) {
        win.addEventListener('mousedown', () => this.focus(id));
        win.querySelector('.btn-close').onclick = () => this.close(id);
        win.querySelector('.btn-minimize').onclick = () => this.minimize(id);
        win.querySelector('.btn-maximize').onclick = () => this.maximize(win);

        const header = win.querySelector('.window-header');
        let isDragging = false, startX, startY, initX, initY;

        header.onmousedown = (e) => {
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            initX = win.offsetLeft; initY = win.offsetTop;
        };
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            win.style.left = `${initX + (e.clientX - startX)}px`;
            let newY = initY + (e.clientY - startY);
            win.style.top = `${newY < 0 ? 0 : newY}px`;
        });
        document.addEventListener('mouseup', () => isDragging = false);
    },

    focus(id) {
        const win = this.activeWindows[id];
        if (win) win.style.zIndex = ++this.zIndex;
        document.querySelectorAll('.taskbar-app').forEach(el => el.classList.remove('active'));
        const tbIcon = document.getElementById(`tb-${id}`);
        if (tbIcon) tbIcon.classList.add('active');
    },

    close(id) {
        if (this.activeWindows[id]) {
            this.activeWindows[id].remove();
            delete this.activeWindows[id];
            document.getElementById(`tb-${id}`).remove();
        }
    },

    minimize(id) {
        this.activeWindows[id].classList.add('minimized');
        document.getElementById(`tb-${id}`).classList.remove('active');
    },

    restore(id) {
        this.activeWindows[id].classList.remove('minimized');
    },

    maximize(win) {
        if (!win.dataset.max) {
            win.dataset.prev = JSON.stringify({ top: win.style.top, left: win.style.left, w: win.style.width, h: win.style.height });
            win.style.top = '0'; win.style.left = '0'; win.style.width = '100%'; win.style.height = 'calc(100% - 48px)';
            win.dataset.max = "true";
        } else {
            const p = JSON.parse(win.dataset.prev);
            win.style.top = p.top; win.style.left = p.left; win.style.width = p.w; win.style.height = p.h;
            delete win.dataset.max;
        }
    },

    createTaskbarIcon(module) {
        const btn = document.createElement('div');
        btn.className = 'taskbar-app active';
        btn.id = `tb-${module.id}`;
        btn.textContent = module.title;
        btn.onclick = () => {
            const win = this.activeWindows[module.id];
            if (win.classList.contains('minimized')) { this.restore(module.id); this.focus(module.id); }
            else if (win.style.zIndex == this.zIndex) this.minimize(module.id);
            else this.focus(module.id);
        };
        this.taskbar.appendChild(btn);
    }
};
