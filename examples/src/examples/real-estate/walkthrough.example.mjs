// @config DESCRIPTION <div style='text-align:center'><div>Real estate walkthrough — (<b>WASD</b>) Move (<b>Mouse</b>) Look</div><div>Click a room name to fly there.</div></div>
import { deviceType, rootPath, fileImport } from 'examples/utils';
import * as pc from 'playcanvas';

const { CameraControls } = await fileImport(`${rootPath}/static/scripts/esm/camera-controls.mjs`);

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('application-canvas'));
window.focus();

const device = await pc.createGraphicsDevice(canvas, {
    deviceTypes: [deviceType],
    antialias: false
});
device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

const createOptions = new pc.AppOptions();
createOptions.graphicsDevice = device;
createOptions.mouse = new pc.Mouse(document.body);
createOptions.touch = new pc.TouchDevice(document.body);
createOptions.keyboard = new pc.Keyboard(window);
createOptions.componentSystems = [
    pc.RenderComponentSystem,
    pc.CameraComponentSystem,
    pc.ScriptComponentSystem,
    pc.GSplatComponentSystem
];
createOptions.resourceHandlers = [pc.TextureHandler, pc.ContainerHandler, pc.ScriptHandler, pc.GSplatHandler];

const app = new pc.AppBase(canvas);
app.init(createOptions);
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => window.removeEventListener('resize', resize));

// Swap this URL with a Gaussian splat scan of your own listing
// (e.g. exported from Polycam, Scaniverse, or PlayCanvas SuperSplat).
const propertyAsset = new pc.Asset('property', 'gsplat', {
    url: `${rootPath}/static/assets/splats/apartment.sog`
});

await new Promise((resolve) => {
    new pc.AssetListLoader([propertyAsset], app.assets).load(resolve);
});

app.start();

// Property splat (transform matches the apartment scan in editor.example.mjs)
const property = new pc.Entity('property');
property.addComponent('gsplat', { asset: propertyAsset, unified: true });
property.setLocalPosition(0, -0.5, -3);
property.setLocalEulerAngles(180, 0, 0);
property.setLocalScale(0.5, 0.5, 0.5);
app.root.addChild(property);

// Waypoints — tuned for the apartment scan. Tweak per-listing.
const ROOMS = [
    { name: 'Entry',       pos: new pc.Vec3(0,  0.4,  2),  yaw:   0, pitch:  -5 },
    { name: 'Living Room', pos: new pc.Vec3(-1, 0.4, -1),  yaw:  30, pitch:  -5 },
    { name: 'Kitchen',     pos: new pc.Vec3(1,  0.4, -2),  yaw: -45, pitch:  -5 },
    { name: 'Bedroom',     pos: new pc.Vec3(-1, 0.4, -4),  yaw: 180, pitch:  -5 }
];

// Camera + fly controls (no orbit/pan, behaves like a walking tour)
const camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.05, 0.05, 0.06),
    fov: 75,
    farClip: 200,
    toneMapping: pc.TONEMAP_ACES
});
camera.addComponent('script');
camera.setPosition(ROOMS[0].pos);
camera.setEulerAngles(ROOMS[0].pitch, ROOMS[0].yaw, 0);
app.root.addChild(camera);

const cc = /** @type {any} */ (camera.script.create(CameraControls, {
    properties: {
        enableOrbit: false,
        enablePan: false,
        moveSpeed: 2,
        moveFastSpeed: 4,
        moveSlowSpeed: 1
    }
}));

// Smooth fly-to between rooms
let flight = null;
const flyTo = (room, duration = 1.2) => {
    flight = {
        t: 0,
        duration,
        fromPos: camera.getPosition().clone(),
        toPos: room.pos.clone(),
        fromRot: camera.getRotation().clone(),
        toRot: new pc.Quat().setFromEulerAngles(room.pitch, room.yaw, 0)
    };
};

const tmpPos = new pc.Vec3();
const tmpRot = new pc.Quat();
app.on('update', (dt) => {
    if (!flight) return;
    flight.t = Math.min(1, flight.t + dt / flight.duration);
    const k = flight.t < 0.5 ? 2 * flight.t * flight.t : 1 - Math.pow(-2 * flight.t + 2, 2) / 2;
    tmpPos.lerp(flight.fromPos, flight.toPos, k);
    tmpRot.slerp(flight.fromRot, flight.toRot, k);
    camera.setPosition(tmpPos);
    camera.setRotation(tmpRot);
    if (flight.t >= 1) {
        flight = null;
        if (typeof cc.refocus === 'function') {
            cc.refocus(camera.getPosition());
        }
    }
});

// Listing info + room buttons (DOM overlay)
const ui = document.createElement('div');
Object.assign(ui.style, {
    position: 'absolute',
    top: '12px',
    left: '12px',
    padding: '12px 14px',
    font: '13px system-ui, sans-serif',
    color: '#fff',
    background: 'rgba(0,0,0,0.55)',
    borderRadius: '8px',
    maxWidth: '260px',
    pointerEvents: 'auto',
    userSelect: 'none'
});
ui.innerHTML = `
    <div style="font-size:15px;font-weight:600;margin-bottom:2px;">123 Example Lane</div>
    <div style="opacity:0.75;margin-bottom:10px;">3 bd · 2 ba · 1,820 sqft</div>
    <div style="opacity:0.75;font-size:11px;margin-bottom:6px;">JUMP TO ROOM</div>
`;
const btnRow = document.createElement('div');
Object.assign(btnRow.style, { display: 'flex', flexWrap: 'wrap', gap: '6px' });
ROOMS.forEach((room) => {
    const b = document.createElement('button');
    b.textContent = room.name;
    Object.assign(b.style, {
        padding: '6px 10px',
        font: 'inherit',
        color: '#fff',
        background: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '999px',
        cursor: 'pointer'
    });
    b.onclick = () => flyTo(room);
    btnRow.appendChild(b);
});
ui.appendChild(btnRow);
document.body.appendChild(ui);
app.on('destroy', () => ui.remove());

export { app };
