
const COLOR_GREEN = 7
const COLOR_BROWN = 14
const COLOR_DAY_SKY = 9
const COLOR_NIGHT_SKY = 15
const COLOR_BLACK = 0
const COLOR_WATER = 8
const COLOR_WHITE = 1
const COLOR_GRAY = 12
const COLOR_BLUE = 9
const COLOR_YELLOW = 5
const COLOR_RED = 2
const COLOR_PURPLE = 4
const COLOR_ORANGE = 3
const COLOR_LIGHT_BLUE = 10
let currentColorSky = COLOR_DAY_SKY

const BLOCK_AIR = 0
const BLOCK_DIRT = 1
const BLOCK_BEDROCK = 2
const BLOCK_WATER = 3
const BLOCK_STONE = 4
const BLOCK_GRASS = 5
const BLOCK_WOOD = 6
const ITEM_STICK = 7
const BLOCK_NETHERRACK = 8
const BLOCK_LAVA = 9
const BLOCK_OBSIDIAN = 10
const BLOCK_PORTAL = 11

// --- DIMENZE ---
enum Dimension { OVERWORLD, NETHER }
let currentDimension: Dimension = Dimension.OVERWORLD

// --- TEXTURY 4x4
const TEXTURES: Image[] = []
TEXTURES[BLOCK_AIR] = null
TEXTURES[BLOCK_DIRT] = img`
    e e e e
    e 4 e e
    e e 4 e
    4 e e 4
`
TEXTURES[BLOCK_BEDROCK] = img`
    f f f f
    f c f c
    f f f f
    c f c f
`
TEXTURES[BLOCK_WATER] = img`
    9 8 9 9
    8 9 9 8
    9 9 8 9
    9 8 9 9
`
TEXTURES[BLOCK_STONE] = img`
    d d d d
    d f d d
    d d d f
    f d d d
`
TEXTURES[BLOCK_GRASS] = img`
    7 6 7 6
    6 7 6 7
    7 6 7 6
    6 7 6 7
`
TEXTURES[BLOCK_WOOD] = img`
    c e c e
    e c e c
    c e c e
    e c e c
`
TEXTURES[BLOCK_NETHERRACK] = img`
    3 2 3 2
    2 3 2 3
    3 2 3 2
    2 3 2 3
`
TEXTURES[BLOCK_LAVA] = img`
    2 4 2 2
    4 2 2 4
    2 2 4 2
    2 4 2 2
`
TEXTURES[BLOCK_OBSIDIAN] = img`
    f c f c
    c f c f
    f c f c
    c f c f
`
TEXTURES[BLOCK_PORTAL] = img`
    a c c c
    c c a c
    c a c c
    c c c a
`

// --- Nastavení grafiky a výkonu ---
const PIXEL_RESOLUTION = 1
const RENDER_DISTANCE = 10
const RENDER_DISTANCE_SQUARED = RENDER_DISTANCE * RENDER_DISTANCE
const PIXEL_BATCH_SIZE = 1000
const WORLD_SIZE = 32
const HALF_PLAYER_HEIGHT = 0.9


// --- Ukládání změn pro každou dimenzi zvlášť ---
const worldChangesOverworld: { [key: number]: number } = {}
const worldChangesNether: { [key: number]: number } = {}
const key = (x: number, y: number, z: number): number => (x & 0xFF) | ((y & 0xFF) << 8) | ((z & 0xFF) << 16)

function getCurrentWorldChanges() {
    return currentDimension === Dimension.OVERWORLD ? worldChangesOverworld : worldChangesNether
}

function setBlock(x: number, y: number, z: number, blockType: number) {
    getCurrentWorldChanges()[key(x, y, z)] = blockType
    resetPrekreslovani()
}

// --- Předpočítaná heightmapa s RANDOM SEEDEM ---
const heightMapOverworld: number[][] = []
const heightMapNether: number[][] = []
let WORLD_SEED = 0

function generateHeightMap() {
    WORLD_SEED = Math.randomRange(1000, 99999)

    // OVERWORLD
    const offsetX1 = (WORLD_SEED % 100) * 0.1
    const offsetY1 = (WORLD_SEED % 150) * 0.1
    const offsetX2 = (WORLD_SEED % 200) * 0.05
    const offsetY2 = (WORLD_SEED % 250) * 0.05

    for (let x = 0; x < WORLD_SIZE; x++) {
        heightMapOverworld[x] = []
        for (let y = 0; y < WORLD_SIZE; y++) {
            const velkeKopce = Math.sin((x + offsetX1) * 0.06) * 6 + Math.cos((y + offsetY1) * 0.06) * 6
            const maleDetaily = Math.sin((x + offsetX2) * 0.3) * 4 + Math.cos((y + offsetY2) * 0.3) * 4
            const finalHeight = velkeKopce + maleDetaily
            heightMapOverworld[x][y] = 2 + Math.floor(Math.abs(finalHeight) % 4)
        }
    }

    // NETHER - plochý s lávovými jezery
    const netherSeed = WORLD_SEED + 1337
    const netherOffsetX = (netherSeed % 80) * 0.1
    const netherOffsetY = (netherSeed % 120) * 0.1

    for (let x = 0; x < WORLD_SIZE; x++) {
        heightMapNether[x] = []
        for (let y = 0; y < WORLD_SIZE; y++) {
            const noise = Math.sin((x + netherOffsetX) * 0.15) * 2 + Math.cos((y + netherOffsetY) * 0.15) * 2
            heightMapNether[x][y] = 3 + Math.floor(Math.abs(noise) % 2)
        }
    }

    // PORTÁL 2 BLOKY OD SPAWNU - na 5,5
    const portalX = 5
    const portalY = 5
    const portalZ = heightMapOverworld[portalX][portalY] + 1

    // Rám z obsidiánu 4x5
    for (let dx = -1; dx <= 2; dx++) {
        for (let dz = 0; dz <= 4; dz++) {
            if (dx === -1 || dx === 2 || dz === 0 || dz === 4) {
                worldChangesOverworld[key(portalX + dx, portalY, portalZ + dz)] = BLOCK_OBSIDIAN
            } else {
                worldChangesOverworld[key(portalX + dx, portalY, portalZ + dz)] = BLOCK_PORTAL
            }
        }
    }

    // PORTÁL V NETHERU na 0,0
    const netherPortalZ = heightMapNether[0][0] + 1
    for (let dx = -1; dx <= 2; dx++) {
        for (let dz = 0; dz <= 4; dz++) {
            if (dx === -1 || dx === 2 || dz === 0 || dz === 4) {
                worldChangesNether[key(dx, 0, netherPortalZ + dz)] = BLOCK_OBSIDIAN
            } else {
                worldChangesNether[key(dx, 0, netherPortalZ + dz)] = BLOCK_PORTAL
            }
        }
    }
}

// --- Generátor světa ---
function getBlock(x: number, y: number, z: number): number {
    const k = key(x, y, z)
    const changed = getCurrentWorldChanges()[k]
    if (changed !== undefined) return changed

    if (z < 0) return BLOCK_AIR
    if (z === 0) return BLOCK_BEDROCK

    if (currentDimension === Dimension.OVERWORLD) {
        if (z === 1) return BLOCK_WATER
        if (z >= 2 && z <= 5) {
            const xi = x | 0
            const yi = y | 0
            if (xi < 0 || xi >= WORLD_SIZE || yi < 0 || yi >= WORLD_SIZE) return BLOCK_AIR
            const terrainTopZ = heightMapOverworld[xi][yi]
            if (z < terrainTopZ) return BLOCK_DIRT
            if (z === terrainTopZ) return BLOCK_GRASS
        }
    } else {
        // NETHER
        if (z === 1) return BLOCK_LAVA
        if (z >= 2 && z <= 4) {
            const xi = x | 0
            const yi = y | 0
            if (xi < 0 || xi >= WORLD_SIZE || yi < 0 || yi >= WORLD_SIZE) return BLOCK_AIR
            const terrainTopZ = heightMapNether[xi][yi]
            if (z <= terrainTopZ) return BLOCK_NETHERRACK
        }
    }
    return BLOCK_AIR
}

// --- Proměnné hráče ---
let player_x = 3.5, player_y = 3.5, player_z = 7
let player_yaw = 0.5, player_pitch = -0.5
let player_vertical_speed = 0
const PLAYER_JUMP_STRENGTH = 0.22
const PLAYER_GRAVITY = 0.02
const PLAYER_HEIGHT = 1.8
const PLAYER_RADIUS = 0.3

// --- Cache sin/cos pro pohyb ---
let sinYaw = 0, cosYaw = 0
let needsTrigUpdate = true
function updatePlayerTrigCache() {
    if (needsTrigUpdate) {
        sinYaw = Math.sin(player_yaw)
        cosYaw = Math.cos(player_yaw)
        needsTrigUpdate = false
    }
}

// --- Konstanty ---
const SCREEN_WIDTH = 160, SCREEN_HEIGHT = 120
const FOV_X = 70 * (Math.PI / 180), FOV_Y = 55 * (Math.PI / 180)
const MOVE_SPEED = 0.25, TURN_SPEED = 0.1
const CENTER_SX = (SCREEN_WIDTH / 2 / PIXEL_RESOLUTION | 0) * PIXEL_RESOLUTION
const CENTER_SY = (SCREEN_HEIGHT / 2 / PIXEL_RESOLUTION | 0) * PIXEL_RESOLUTION

const worldCanvas = image.create(SCREEN_WIDTH, SCREEN_HEIGHT)
const canvas = image.create(SCREEN_WIDTH, SCREEN_HEIGHT)
let current_sx = 0, current_sy = 0

// --- Debug UI a den/noc ---
let showDebugUI = false
let isBDown = false
let isRightDown = false
let frameCount = 0
const DAY_NIGHT_CYCLE_LENGTH = 100
let dayNightStatus = "DEN"
let lookedAtBlockX = 0, lookedAtBlockY = 0, lookedAtBlockZ = 0

const debugSpriteP = sprites.create(img`.`, SpriteKind.Player)
const debugSpriteB = sprites.create(img`.`, SpriteKind.Player)
const debugSpriteC = sprites.create(img`.`, SpriteKind.Player)
const debugSpriteD = sprites.create(img`.`, SpriteKind.Player)
const allDebugSprites = [debugSpriteP, debugSpriteB, debugSpriteC, debugSpriteD]

function setupDebugUI() {
    for (const s of allDebugSprites) {
        s.setFlag(SpriteFlag.Ghost, true)
        s.setFlag(SpriteFlag.Invisible, true)
        s.left = 2
    }
    debugSpriteP.bottom = 120 - 32
    debugSpriteB.bottom = 120 - 22
    debugSpriteC.bottom = 120 - 12
    debugSpriteD.bottom = 120 - 2
}

// --- UI režimu ---
enum ControlMode { Walk, Look, UI, Build, Craft }
let currentControlMode: ControlMode = ControlMode.Walk
const modeSprite = sprites.create(img`.`, SpriteKind.Player)
modeSprite.setFlag(SpriteFlag.Ghost, true)
modeSprite.setPosition(35, 8)
let lastModeText = ""
const percentSprite = sprites.create(img`.`, SpriteKind.Player)
percentSprite.setFlag(SpriteFlag.Invisible, true)
percentSprite.setFlag(SpriteFlag.Ghost, true)
percentSprite.setPosition(145, 8)

// UI proměnné
let inventoryOpen = false
const HOTBAR_SLOTS = 9
const INVENTORY_COLS = 9
const INVENTORY_ROWS = 3
const SLOT_SIZE = 14
const MAX_STACK = 64
let selectedSlotX = 0
let selectedSlotY = 3

// Crafting mřížka 3x3
const craftingGrid: ItemSlot[] = []
let craftingOpen = false
for (let i = 0; i < 9; i++) {
    craftingGrid.push({ type: BLOCK_AIR, count: 0 })
}
let craftingSelectedX = 0
let craftingSelectedY = 4

// Inventář
type ItemSlot = { type: number, count: number }
const inventory: ItemSlot[] = []
for (let i = 0; i < HOTBAR_SLOTS + INVENTORY_COLS * INVENTORY_ROWS; i++) {
    inventory.push({ type: BLOCK_AIR, count: 0 })
}
inventory[0] = { type: BLOCK_DIRT, count: 64 }
inventory[1] = { type: BLOCK_WOOD, count: 64 }
inventory[2] = { type: BLOCK_STONE, count: 64 }
inventory[3] = { type: BLOCK_GRASS, count: 64 }
inventory[4] = { type: BLOCK_OBSIDIAN, count: 64 }
const heldItem: ItemSlot = { type: BLOCK_AIR, count: 0 }

const getSlotIndex = (x: number, y: number): number => y === 3 ? x : HOTBAR_SLOTS + y * INVENTORY_COLS + x

function cleanSlot(slot: ItemSlot) {
    if (slot.count <= 0) {
        slot.type = BLOCK_AIR
        slot.count = 0
    }
}

function addItemToInventory(itemType: number, amount: number): boolean {
    let remaining = amount
    for (let i = 0; i < inventory.length; i++) {
        const slot = inventory[i]
        if (slot.type === itemType && slot.count < MAX_STACK) {
            const space = MAX_STACK - slot.count
            const toAdd = space < remaining ? space : remaining
            slot.count += toAdd
            remaining -= toAdd
            if (remaining === 0) return true
        }
    }
    for (let i = 0; i < inventory.length; i++) {
        const slot = inventory[i]
        if (slot.type === BLOCK_AIR || slot.count === 0) {
            const toAdd = MAX_STACK < remaining ? MAX_STACK : remaining
            slot.type = itemType
            slot.count = toAdd
            remaining -= toAdd
            if (remaining === 0) return true
        }
    }
    return false
}

// --- Crafting ---
function getCraftingResultCraft(): ItemSlot {
    let woodCount = 0
    let otherCount = 0
    for (let i = 0; i < 9; i++) {
        const slot = craftingGrid[i]
        if (slot.type === BLOCK_WOOD) woodCount += slot.count
        else if (slot.type !== BLOCK_AIR) otherCount += slot.count
    }
    if (woodCount >= 1 && otherCount === 0) {
        return { type: ITEM_STICK, count: 4 }
    }
    return { type: BLOCK_AIR, count: 0 }
}

function doCraftCraft() {
    const result = getCraftingResultCraft()
    if (result.type === BLOCK_AIR) return
    for (let i = 0; i < 9; i++) {
        const slot = craftingGrid[i]
        if (slot.type === BLOCK_WOOD && slot.count > 0) {
            slot.count -= 1
            cleanSlot(slot)
            addItemToInventory(result.type, result.count)
            return
        }
    }
}

// --- TELEPORT DO NETHERU ---
let teleportCooldown = 0
function checkPortalTeleport() {
    if (teleportCooldown > 0) {
        teleportCooldown--
        return
    }

    const blockBelow = getBlock(player_x | 0, player_y | 0, (player_z - 0.1) | 0)
    const blockAtFeet = getBlock(player_x | 0, player_y | 0, player_z | 0)

    if (blockBelow === BLOCK_PORTAL || blockAtFeet === BLOCK_PORTAL) {
        if (currentDimension === Dimension.OVERWORLD) {
            currentDimension = Dimension.NETHER
            player_x = 0.5
            player_y = 0.5
            player_z = 6
            game.splash("NETHER")
            currentColorSky = COLOR_RED
        } else {
            currentDimension = Dimension.OVERWORLD
            player_x = 0.5
            player_y = 0.5
            player_z = 7
            game.splash("OVERWORLD")
            currentColorSky = COLOR_DAY_SKY
        }
        teleportCooldown = 60
        resetPrekreslovani()
    }
}

// --- DDA RAYCAST ---
let dda_hit = false, dda_x = 0, dda_y = 0, dda_z = 0, dda_block = 0, dda_normal = 0
let dda_hitX = 0, dda_hitY = 0, dda_hitZ = 0, dda_placeX = 0, dda_placeY = 0, dda_placeZ = 0

function ddaRaycast(yaw: number, pitch: number): boolean {
    const cosPitch = Math.cos(pitch)
    const dirX = Math.sin(yaw) * cosPitch
    const dirY = Math.cos(yaw) * cosPitch
    const dirZ = Math.sin(pitch)

    let mapX = player_x | 0
    let mapY = player_y | 0
    let mapZ = (player_z + HALF_PLAYER_HEIGHT) | 0

    const deltaDistX = dirX === 0 ? 1e30 : Math.abs(1 / dirX)
    const deltaDistY = dirY === 0 ? 1e30 : Math.abs(1 / dirY)
    const deltaDistZ = dirZ === 0 ? 1e30 : Math.abs(1 / dirZ)

    let stepX = 0, stepY = 0, stepZ = 0
    let sideDistX = 0, sideDistY = 0, sideDistZ = 0

    if (dirX < 0) {
        stepX = -1
        sideDistX = (player_x - mapX) * deltaDistX
    } else {
        stepX = 1
        sideDistX = (mapX + 1.0 - player_x) * deltaDistX
    }
    if (dirY < 0) {
        stepY = -1
        sideDistY = (player_y - mapY) * deltaDistY
    } else {
        stepY = 1
        sideDistY = (mapY + 1.0 - player_y) * deltaDistY
    }
    if (dirZ < 0) {
        stepZ = -1
        sideDistZ = (player_z + HALF_PLAYER_HEIGHT - mapZ) * deltaDistZ
    } else {
        stepZ = 1
        sideDistZ = (mapZ + 1.0 - (player_z + HALF_PLAYER_HEIGHT)) * deltaDistZ
    }

    let lastX = mapX, lastY = mapY, lastZ = mapZ
    let side = 0

    for (let i = 0; i < RENDER_DISTANCE * 2; i++) {
        if (sideDistX < sideDistY && sideDistX < sideDistZ) {
            sideDistX += deltaDistX
            lastX = mapX
            mapX += stepX
            side = 0
        } else if (sideDistY < sideDistZ) {
            sideDistY += deltaDistY
            lastY = mapY
            mapY += stepY
            side = 1
        } else {
            sideDistZ += deltaDistZ
            lastZ = mapZ
            mapZ += stepZ
            side = 2
        }

        const dx = mapX - player_x
        const dy = mapY - player_y
        if (dx * dx + dy * dy > RENDER_DISTANCE_SQUARED) break

        const block = getBlock(mapX, mapY, mapZ)
        if (block > 0 && block !== BLOCK_WATER && block !== BLOCK_LAVA) {
            let dist = 0
            if (side === 0) dist = (mapX - player_x + (1 - stepX) * 0.5) / dirX
            else if (side === 1) dist = (mapY - player_y + (1 - stepY) * 0.5) / dirY
            else dist = (mapZ - (player_z + HALF_PLAYER_HEIGHT) + (1 - stepZ) * 0.5) / dirZ

            dda_hit = true
            dda_x = mapX
            dda_y = mapY
            dda_z = mapZ
            dda_block = block
            dda_normal = side
            dda_hitX = player_x + dirX * dist
            dda_hitY = player_y + dirY * dist
            dda_hitZ = player_z + HALF_PLAYER_HEIGHT + dirZ * dist
            dda_placeX = lastX
            dda_placeY = lastY
            dda_placeZ = lastZ
            return true
        }
    }
    dda_hit = false
    return false
}

function raycastTarget() {
    ddaRaycast(player_yaw, player_pitch)
    return { x: dda_x, y: dda_y, z: dda_z, block: dda_block }
}

function updateModeUI() {
    let newText = ""
    if (currentControlMode === ControlMode.Walk) newText = "WALK"
    else if (currentControlMode === ControlMode.Look) newText = "LOOK"
    else if (currentControlMode === ControlMode.Build) newText = "BUILD"
    else if (currentControlMode === ControlMode.Craft) newText = "CRAFT"
    else newText = "UI"
    if (newText !== lastModeText) { modeSprite.say(newText); lastModeText = newText }
}

function resetPrekreslovani() {
    current_sx = 0
    current_sy = 0
    percentSprite.say("0%")
}

function drawItemInSlot(slot: ItemSlot, x: number, y: number) {
    if (slot.type === BLOCK_AIR || slot.count === 0) return

    if (slot.type === ITEM_STICK) {
        canvas.print("|", x + 5, y + 4, COLOR_BROWN)
    } else {
        const texture = TEXTURES[slot.type]
        if (texture) {
            for (let ty = 0; ty < 4; ty++) {
                for (let tx = 0; tx < 4; tx++) {
                    const col = texture.getPixel(tx, ty)
                    canvas.fillRect(x + 3 + tx * 2, y + 3 + ty * 2, 2, 2, col)
                }
            }
        }
    }
    if (slot.count > 1) {
        const countStr = slot.count.toString()
        canvas.print(countStr, x + SLOT_SIZE - 4 - countStr.length * 4, y + SLOT_SIZE - 6, COLOR_WHITE)
    }
}

function drawHeldItem() {
    if (heldItem.type === BLOCK_AIR || heldItem.count === 0) return
    if (currentControlMode !== ControlMode.UI && currentControlMode !== ControlMode.Craft) return
    canvas.fillRect(2, 2, SLOT_SIZE, SLOT_SIZE, COLOR_YELLOW)
    drawItemInSlot(heldItem, 2, 2)
}

function drawHotbar() {
    const hotbarY = SCREEN_HEIGHT - SLOT_SIZE - 2
    const startX = (SCREEN_WIDTH - (HOTBAR_SLOTS * SLOT_SIZE)) / 2
    const buttonX = startX - SLOT_SIZE - 2
    canvas.fillRect(buttonX, hotbarY, SLOT_SIZE, SLOT_SIZE, COLOR_BLUE)
    const buttonBorder = (currentControlMode === ControlMode.UI && selectedSlotY === 3 && selectedSlotX === -1) ? COLOR_WHITE : COLOR_BLACK
    canvas.drawRect(buttonX, hotbarY, SLOT_SIZE, SLOT_SIZE, buttonBorder)
    canvas.print("E", buttonX + 5, hotbarY + 4, COLOR_WHITE)
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
        const x = startX + i * SLOT_SIZE
        canvas.fillRect(x, hotbarY, SLOT_SIZE, SLOT_SIZE, COLOR_GRAY)
        let borderColor = COLOR_BLACK
        if (currentControlMode === ControlMode.UI && selectedSlotY === 3 && selectedSlotX === i) borderColor = COLOR_WHITE
        if (currentControlMode === ControlMode.Craft && craftingSelectedY === 4 && craftingSelectedX === i) borderColor = COLOR_WHITE
        canvas.drawRect(x, hotbarY, SLOT_SIZE, SLOT_SIZE, borderColor)
        drawItemInSlot(inventory[i], x, hotbarY)
    }
}

function drawInventory() {
    if (!inventoryOpen) return
    const invWidth = INVENTORY_COLS * SLOT_SIZE
    const invHeight = INVENTORY_ROWS * SLOT_SIZE
    const startX = (SCREEN_WIDTH - invWidth) / 2
    const startY = 25
    canvas.fillRect(startX - 2, startY - 2, invWidth + 4, invHeight + 4, COLOR_BLACK)
    for (let row = 0; row < INVENTORY_ROWS; row++) {
        for (let col = 0; col < INVENTORY_COLS; col++) {
            const x = startX + col * SLOT_SIZE
            const y = startY + row * SLOT_SIZE
            canvas.fillRect(x, y, SLOT_SIZE, SLOT_SIZE, COLOR_GRAY)
            const borderColor = (currentControlMode === ControlMode.UI && selectedSlotY === row && selectedSlotX === col) ? COLOR_WHITE : COLOR_BLACK
            canvas.drawRect(x, y, SLOT_SIZE, SLOT_SIZE, borderColor)
            drawItemInSlot(inventory[getSlotIndex(col, row)], x, y)
        }
    }
}

function drawCrafting() {
    if (!craftingOpen) return
    const gridWidth = 3 * SLOT_SIZE
    const gridHeight = 3 * SLOT_SIZE
    const startX = (SCREEN_WIDTH - gridWidth) / 2
    const startY = 25
    canvas.fillRect(startX - 2, startY - 2, gridWidth + 4, gridHeight + 4, COLOR_BLACK)
    canvas.print("CRAFTING", startX, startY - 10, COLOR_WHITE)

    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            const x = startX + col * SLOT_SIZE
            const y = startY + row * SLOT_SIZE
            canvas.fillRect(x, y, SLOT_SIZE, SLOT_SIZE, COLOR_GRAY)
            const borderColor = (craftingSelectedY === row && craftingSelectedX === col) ? COLOR_WHITE : COLOR_BLACK
            canvas.drawRect(x, y, SLOT_SIZE, SLOT_SIZE, borderColor)
            drawItemInSlot(craftingGrid[row * 3 + col], x, y)
        }
    }

    const result = getCraftingResultCraft()
    const resultY = startY + gridHeight + 4
    const resultX = startX + SLOT_SIZE
    canvas.fillRect(resultX, resultY, SLOT_SIZE, SLOT_SIZE, COLOR_GRAY)
    const resultBorder = (craftingSelectedY === 3) ? COLOR_WHITE : COLOR_BLACK
    canvas.drawRect(resultX, resultY, SLOT_SIZE, SLOT_SIZE, resultBorder)
    canvas.print("->", startX + 2, resultY + 4, COLOR_WHITE)
    drawItemInSlot(result, resultX, resultY)
}

// --- Kolize ---
function checkCollision(targetX: number, targetY: number, targetZ: number): boolean {
    const minX = (targetX - PLAYER_RADIUS) | 0, maxX = (targetX + PLAYER_RADIUS) | 0
    const minY = (targetY - PLAYER_RADIUS) | 0, maxY = (targetY + PLAYER_RADIUS) | 0
    const minZ = targetZ | 0, maxZ = (targetZ + PLAYER_HEIGHT - 0.01) | 0
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
        const block = getBlock(x, y, z)
        if (block !== BLOCK_AIR && block !== BLOCK_PORTAL) return true
    }
    return false
}

// --- Fyzika ---
function updatePlayerPhysics() {
    if (current_sx < SCREEN_WIDTH) return
    if (currentControlMode === ControlMode.UI || currentControlMode === ControlMode.Craft) return
    player_vertical_speed -= PLAYER_GRAVITY
    const new_player_z = player_z + player_vertical_speed
    if (checkCollision(player_x, player_y, new_player_z)) {
        if (player_vertical_speed < 0) { player_z = Math.ceil(new_player_z); resetPrekreslovani() }
        player_vertical_speed = 0
    } else {
        if (Math.abs(player_z - new_player_z) > 0.001) {
            player_z = new_player_z
            resetPrekreslovani()
        }
    }
    checkPortalTeleport()
}

// --- Ovládání ---
function toggleDebugUI() {
    showDebugUI = !showDebugUI
    for (const s of allDebugSprites) {
        s.setFlag(SpriteFlag.Invisible, !showDebugUI)
    }
}

controller.B.onEvent(ControllerButtonEvent.Pressed, function () {
    isBDown = true
    if (isRightDown) {
        toggleDebugUI()
    } else {
        if (currentControlMode === ControlMode.Walk) currentControlMode = ControlMode.Look
        else if (currentControlMode === ControlMode.Look) currentControlMode = ControlMode.Build
        else if (currentControlMode === ControlMode.Build) currentControlMode = ControlMode.Craft
        else if (currentControlMode === ControlMode.Craft) currentControlMode = ControlMode.UI
        else currentControlMode = ControlMode.Walk

        if (currentControlMode !== ControlMode.UI && currentControlMode !== ControlMode.Craft) {
            inventoryOpen = false
            craftingOpen = false
            selectedSlotY = 3
            if (heldItem.count > 0) {
                addItemToInventory(heldItem.type, heldItem.count)
                heldItem.type = BLOCK_AIR
                heldItem.count = 0
            }
        } else if (currentControlMode === ControlMode.UI) {
            selectedSlotY = 3
            selectedSlotX = 0
            craftingOpen = false
        } else if (currentControlMode === ControlMode.Craft) {
            craftingSelectedX = 0
            craftingSelectedY = 4
            craftingOpen = false
        }
        updateModeUI()
    }
})

controller.right.onEvent(ControllerButtonEvent.Pressed, function () {
    isRightDown = true
    if (isBDown) {
        toggleDebugUI()
    } else {
        if (currentControlMode === ControlMode.Walk) {
            updatePlayerTrigCache()
            const new_player_x = player_x + cosYaw * MOVE_SPEED
            const new_player_y = player_y - sinYaw * MOVE_SPEED
            if (!checkCollision(new_player_x, new_player_y, player_z)) { player_x = new_player_x; player_y = new_player_y; resetPrekreslovani() }
        } else if (currentControlMode === ControlMode.Look || currentControlMode === ControlMode.Build) {
            player_yaw += TURN_SPEED
            needsTrigUpdate = true
            resetPrekreslovani()
        } else if (currentControlMode === ControlMode.UI) {
            selectedSlotX = selectedSlotX < HOTBAR_SLOTS - 1 ? selectedSlotX + 1 : selectedSlotX
        } else if (currentControlMode === ControlMode.Craft) {
            if (craftingOpen && craftingSelectedY < 3) {
                craftingSelectedX = craftingSelectedX < 2 ? craftingSelectedX + 1 : craftingSelectedX
            } else if (craftingSelectedY === 4) {
                craftingSelectedX = craftingSelectedX < HOTBAR_SLOTS - 1 ? craftingSelectedX + 1 : craftingSelectedX
            }
        }
    }
})
controller.B.onEvent(ControllerButtonEvent.Released, () => isBDown = false)
controller.right.onEvent(ControllerButtonEvent.Released, () => isRightDown = false)

controller.right.onEvent(ControllerButtonEvent.Released, () => isRightDown = false)

controller.A.onEvent(ControllerButtonEvent.Pressed, function () {
    if (currentControlMode === ControlMode.Look) {
        const target = raycastTarget()
        if (target.block !== BLOCK_AIR && target.block !== BLOCK_BEDROCK && target.block !== BLOCK_PORTAL) {
            if (target.block === BLOCK_DIRT || target.block === BLOCK_GRASS || target.block === BLOCK_STONE || target.block === BLOCK_WOOD || target.block === BLOCK_NETHERRACK || target.block === BLOCK_OBSIDIAN) {
                addItemToInventory(target.block, 1)
            }
            setBlock(target.x, target.y, target.z, BLOCK_AIR)
            if (showDebugUI) debugSpriteB.say(`VYTĚŽENO!`)
        }
    } else if (currentControlMode === ControlMode.Build) {
        ddaRaycast(player_yaw, player_pitch)
        if (dda_hit) {
            const selectedSlot = inventory[getSlotIndex(selectedSlotX, 3)]
            if (selectedSlot.count > 0 && selectedSlot.type !== BLOCK_AIR && selectedSlot.type !== ITEM_STICK) {
                const placeX = dda_placeX, placeY = dda_placeY, placeZ = dda_placeZ
                const playerMinX = (player_x - PLAYER_RADIUS) | 0
                const playerMaxX = (player_x + PLAYER_RADIUS) | 0
                const playerMinY = (player_y - PLAYER_RADIUS) | 0
                const playerMaxY = (player_y + PLAYER_RADIUS) | 0
                const playerMinZ = player_z | 0
                const playerMaxZ = (player_z + PLAYER_HEIGHT - 0.01) | 0
                const inPlayer = (placeX >= playerMinX && placeX <= playerMaxX &&
                    placeY >= playerMinY && placeY <= playerMaxY &&
                    placeZ >= playerMinZ && placeZ <= playerMaxZ)
                if (!inPlayer && getBlock(placeX, placeY, placeZ) === BLOCK_AIR) {
                    setBlock(placeX, placeY, placeZ, selectedSlot.type)
                    selectedSlot.count -= 1
                    cleanSlot(selectedSlot)
                    if (showDebugUI) debugSpriteB.say(`POLOŽENO!`)
                }
            }
        }
    } else if (currentControlMode === ControlMode.Walk) {
        if (getBlock(player_x | 0, player_y | 0, (player_z - 0.1) | 0) !== BLOCK_AIR) {
            player_vertical_speed = PLAYER_JUMP_STRENGTH
            resetPrekreslovani()
        }
    } else if (currentControlMode === ControlMode.Craft) {
        if (!craftingOpen) {
            craftingOpen = true
            return
        }
        if (craftingSelectedY === 3) {
            doCraftCraft()
        } else if (craftingSelectedY === 4) {
            const slot = inventory[craftingSelectedX]
            if (heldItem.count === 0) {
                if (slot.count > 0) {
                    heldItem.type = slot.type
                    heldItem.count = slot.count
                    slot.type = BLOCK_AIR
                    slot.count = 0
                }
            } else {
                if (slot.count === 0) {
                    slot.type = heldItem.type
                    slot.count = heldItem.count
                    heldItem.type = BLOCK_AIR
                    heldItem.count = 0
                } else if (slot.type === heldItem.type && slot.count < MAX_STACK) {
                    const space = MAX_STACK - slot.count
                    const toAdd = space < heldItem.count ? space : heldItem.count
                    slot.count += toAdd
                    heldItem.count -= toAdd
                    cleanSlot(heldItem)
                } else {
                    const tempType = slot.type, tempCount = slot.count
                    slot.type = heldItem.type
                    slot.count = heldItem.count
                    heldItem.type = tempType
                    heldItem.count = tempCount
                }
            }
            cleanSlot(slot)
        } else {
            const idx = craftingSelectedY * 3 + craftingSelectedX
            const slot = craftingGrid[idx]
            if (heldItem.count === 0) {
                if (slot.count > 0) {
                    heldItem.type = slot.type
                    heldItem.count = slot.count
                    slot.type = BLOCK_AIR
                    slot.count = 0
                }
            } else {
                if (slot.count === 0) {
                    slot.type = heldItem.type
                    slot.count = heldItem.count
                    heldItem.type = BLOCK_AIR
                    heldItem.count = 0
                } else if (slot.type === heldItem.type && slot.count < MAX_STACK) {
                    const space = MAX_STACK - slot.count
                    const toAdd = space < heldItem.count ? space : heldItem.count
                    slot.count += toAdd
                    heldItem.count -= toAdd
                    cleanSlot(heldItem)
                } else {
                    const tempType = slot.type, tempCount = slot.count
                    slot.type = heldItem.type
                    slot.count = heldItem.count
                    heldItem.type = tempType
                    heldItem.count = tempCount
                }
            }
            cleanSlot(slot)
        }
    } else if (currentControlMode === ControlMode.UI) {
        if (selectedSlotX === -1 && selectedSlotY === 3) {
            inventoryOpen = !inventoryOpen
            if (inventoryOpen) { selectedSlotY = 2; selectedSlotX = 0 }
            else { selectedSlotY = 3 }
            return
        }
        const slotIdx = getSlotIndex(selectedSlotX, selectedSlotY)
        const slot = inventory[slotIdx]
        if (heldItem.count === 0) {
            if (slot.count > 0) {
                heldItem.type = slot.type
                heldItem.count = slot.count
                slot.type = BLOCK_AIR
                slot.count = 0
            }
        } else {
            if (slot.count === 0) {
                slot.type = heldItem.type
                slot.count = heldItem.count
                heldItem.type = BLOCK_AIR
                heldItem.count = 0
            } else if (slot.type === heldItem.type && slot.count < MAX_STACK) {
                const space = MAX_STACK - slot.count
                const toAdd = space < heldItem.count ? space : heldItem.count
                slot.count += toAdd
                heldItem.count -= toAdd
                cleanSlot(heldItem)
            } else {
                const tempType = slot.type, tempCount = slot.count
                slot.type = heldItem.type
                slot.count = heldItem.count
                heldItem.type = tempType
                heldItem.count = tempCount
            }
        }
        cleanSlot(slot)
    }
})

controller.up.onEvent(ControllerButtonEvent.Pressed, function () {
    if (currentControlMode === ControlMode.Walk) {
        updatePlayerTrigCache()
        const new_player_x = player_x + sinYaw * MOVE_SPEED
        const new_player_y = player_y + cosYaw * MOVE_SPEED
        if (!checkCollision(new_player_x, new_player_y, player_z)) { player_x = new_player_x; player_y = new_player_y; resetPrekreslovani() }
    } else if (currentControlMode === ControlMode.Look || currentControlMode === ControlMode.Build) {
        player_pitch = Math.max(-1.5, Math.min(1.5, player_pitch + TURN_SPEED)); resetPrekreslovani()
    } else if (currentControlMode === ControlMode.UI) {
        if (inventoryOpen && selectedSlotY === 0) selectedSlotY = 3
        else if (selectedSlotY > 0) selectedSlotY = selectedSlotY - 1
    } else if (currentControlMode === ControlMode.Craft) {
        if (craftingOpen) {
            if (craftingSelectedY === 0) craftingSelectedY = 4
            else if (craftingSelectedY > 0) craftingSelectedY = craftingSelectedY - 1
        } else {
            craftingSelectedY = 4
        }
    }
})

controller.down.onEvent(ControllerButtonEvent.Pressed, function () {
    if (currentControlMode === ControlMode.Walk) {
        updatePlayerTrigCache()
        const new_player_x = player_x - sinYaw * MOVE_SPEED
        const new_player_y = player_y - cosYaw * MOVE_SPEED
        if (!checkCollision(new_player_x, new_player_y, player_z)) { player_x = new_player_x; player_y = new_player_y; resetPrekreslovani() }
    } else if (currentControlMode === ControlMode.Look || currentControlMode === ControlMode.Build) {
        player_pitch = Math.max(-1.5, Math.min(1.5, player_pitch - TURN_SPEED)); resetPrekreslovani()
    } else if (currentControlMode === ControlMode.UI) {
        if (inventoryOpen && selectedSlotY === 3) selectedSlotY = 0
        else {
            const maxY = inventoryOpen ? 3 : 3
            if (selectedSlotY < maxY) selectedSlotY = selectedSlotY + 1
        }
    } else if (currentControlMode === ControlMode.Craft) {
        if (craftingOpen) {
            if (craftingSelectedY === 4) craftingSelectedY = 0
            else if (craftingSelectedY < 4) craftingSelectedY = craftingSelectedY + 1
        } else {
            craftingSelectedY = 4
        }
    }
})

controller.left.onEvent(ControllerButtonEvent.Pressed, function () {
    if (currentControlMode === ControlMode.Walk) {
        updatePlayerTrigCache()
        const new_player_x = player_x - cosYaw * MOVE_SPEED
        const new_player_y = player_y + sinYaw * MOVE_SPEED
        if (!checkCollision(new_player_x, new_player_y, player_z)) { player_x = new_player_x; player_y = new_player_y; resetPrekreslovani() }
    } else if (currentControlMode === ControlMode.Look || currentControlMode === ControlMode.Build) {
        player_yaw -= TURN_SPEED
        needsTrigUpdate = true
        resetPrekreslovani()
    } else if (currentControlMode === ControlMode.UI) {
        selectedSlotX = selectedSlotX > -1 ? selectedSlotX - 1 : selectedSlotX
    } else if (currentControlMode === ControlMode.Craft) {
        if (craftingOpen && craftingSelectedY < 3) {
            craftingSelectedX = craftingSelectedX > 0 ? craftingSelectedX - 1 : craftingSelectedX
        } else if (craftingSelectedY === 4) {
            craftingSelectedX = craftingSelectedX > 0 ? craftingSelectedX - 1 : craftingSelectedX
        }
    }
})

// --- ZÍSKÁNÍ BARVY Z TEXTURY ---
function getBlockColor(blockType: number, hitX: number, hitY: number, hitZ: number, hitNormal: number): number {
    if (blockType === BLOCK_AIR) return currentColorSky
    const texture = TEXTURES[blockType]
    if (!texture) return COLOR_GRAY
    let u = 0, v = 0
    if (hitNormal === 0) {
        u = hitY - (hitY | 0)
        v = hitZ - (hitZ | 0)
    } else if (hitNormal === 1) {
        u = hitX - (hitX | 0)
        v = hitZ - (hitZ | 0)
    } else {
        u = hitX - (hitX | 0)
        v = hitY - (hitY | 0)
    }
    if (u < 0) u += 1
    if (v < 0) v += 1
    const texX = (u * 4) | 0
    const texY = (v * 4) | 0
    return texture.getPixel(texX, texY)
}

// --- Hlavní smyčka s DDA ---
game.onUpdate(function () {
    updatePlayerPhysics()

    if (current_sx === 0 && current_sy === 0) {
        if ((frameCount & 63) === 0) {
            const viewX = Math.sin(player_yaw) * Math.cos(player_pitch)
            const viewY = Math.cos(player_yaw) * Math.cos(player_pitch)
            const viewZ = Math.sin(player_pitch)
            const changes = getCurrentWorldChanges()
            const keys = Object.keys(changes)
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i]
                const keyNum = parseInt(k)
                const bx = (keyNum & 0xFF) + 0.5
                const by = ((keyNum >> 8) & 0xFF) + 0.5
                const bz = ((keyNum >> 16) & 0xFF) + 0.5
                const dx = bx - player_x, dy = by - player_y, dz = bz - (player_z + HALF_PLAYER_HEIGHT)
                const dist2 = dx * dx + dy * dy + dz * dz
                const dot = dx * viewX + dy * viewY + dz * viewZ
                if (dist2 > RENDER_DISTANCE_SQUARED + 4 || dot < 0) delete changes[keyNum]
            }
        }

        frameCount++
        if (currentDimension === Dimension.OVERWORLD) {
            if (frameCount <= DAY_NIGHT_CYCLE_LENGTH) {
                dayNightStatus = "DEN"
                currentColorSky = COLOR_DAY_SKY
            } else {
                dayNightStatus = "NOC"
                currentColorSky = COLOR_NIGHT_SKY
            }
            if (frameCount > DAY_NIGHT_CYCLE_LENGTH * 2) frameCount = 0
        } else {
            currentColorSky = COLOR_RED
            dayNightStatus = "NETHER"
        }
    }

    if (showDebugUI) {
        const px_str = (player_x * 10 | 0) / 10
        const py_str = (player_y * 10 | 0) / 10
        const pz_str = (player_z * 10 | 0) / 10
        debugSpriteP.say(`P: ${px_str}, ${py_str}, ${pz_str}`)
        debugSpriteB.say(`B: ${lookedAtBlockX}, ${lookedAtBlockY}, ${lookedAtBlockZ}`)
        debugSpriteC.say(`C: ${frameCount} ${dayNightStatus}`)
        debugSpriteD.say(`D: ${currentDimension === Dimension.OVERWORLD ? "OVER" : "NETH"}`)
    }

    for (let i = 0; i < PIXEL_BATCH_SIZE; i++) {
        if (current_sx >= SCREEN_WIDTH) break

        if (current_sy === 0) {
            worldCanvas.fillRect(current_sx, 0, PIXEL_RESOLUTION, SCREEN_HEIGHT, currentColorSky)
        }

        const center_sx = current_sx + (PIXEL_RESOLUTION >> 1)
        const center_sy = current_sy + (PIXEL_RESOLUTION >> 1)
        const ray_yaw = player_yaw + ((center_sx / SCREEN_WIDTH) - 0.5) * FOV_X
        const ray_pitch = player_pitch - ((center_sy / SCREEN_HEIGHT) - 0.5) * FOV_Y

        if (ddaRaycast(ray_yaw, ray_pitch)) {
            const color = getBlockColor(dda_block, dda_hitX, dda_hitY, dda_hitZ, dda_normal)
            worldCanvas.fillRect(current_sx, current_sy, PIXEL_RESOLUTION, PIXEL_RESOLUTION, color)

            if (current_sx === CENTER_SX && current_sy === CENTER_SY) {
                lookedAtBlockX = dda_x
                lookedAtBlockY = dda_y
                lookedAtBlockZ = dda_z
            }
        }

        current_sy += PIXEL_RESOLUTION
        if (current_sy >= SCREEN_HEIGHT) {
            current_sy = 0
            current_sx += PIXEL_RESOLUTION
            percentSprite.say((current_sx * 100 / SCREEN_WIDTH | 0) + "%")
        }
    }

    canvas.copyFrom(worldCanvas)
    drawHotbar()
    drawInventory()
    drawCrafting()
    drawHeldItem()
    scene.setBackgroundImage(canvas)
})

// --- START HRY ---
setupDebugUI()
updateModeUI()
generateHeightMap()
resetPrekreslovani()

// Ukaž seed na začátku
game.splash("Seed: " + WORLD_SEED)
