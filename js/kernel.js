export const Kernel = {
    modules: {},
    events: {},
    
    init() {
        console.log("%c[CIIS KERNEL] Iniciando núcleo de sistema...", "color: #00e5ff; font-weight: bold;");
        this.emit('system:ready', { time: Date.now() });
    },
    
    registerModule(module) {
        this.modules[module.id] = module;
        console.log(`[CIIS KERNEL] Módulo registrado: ${module.title}`);
    },
    
    getModules() {
        return Object.values(this.modules);
    },
    
    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
    },
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(cb => cb(data));
        }
    }
};
