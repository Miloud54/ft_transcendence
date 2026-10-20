"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCheatEnabled = isCheatEnabled;
exports.writeCheatFile = writeCheatFile;
const common_1 = require("@nestjs/common");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const logger = new common_1.Logger('CheatFile');
function isCheatEnabled() {
    return (process.env.PEDANTIX_CHEAT === 'true' &&
        process.env.NODE_ENV !== 'production');
}
async function writeCheatFile(gameId, article, dir = process.env.PEDANTIX_CHEAT_DIR ??
    (0, node_path_1.join)(process.cwd(), 'cheat')) {
    if (!isCheatEnabled())
        return null;
    const content = [
        `Title: ${article.title}`,
        `URL: ${article.url}`,
        `Game: ${gameId}`,
        '',
        ...article.paragraphs.flatMap((paragraph) => [paragraph, '']),
    ].join('\n');
    try {
        await (0, promises_1.mkdir)(dir, { recursive: true });
        const file = (0, node_path_1.join)(dir, `game-${gameId}.txt`);
        await (0, promises_1.writeFile)(file, content, 'utf8');
        await (0, promises_1.writeFile)((0, node_path_1.join)(dir, 'latest.txt'), content, 'utf8');
        logger.warn(`Cheat file written: ${file}`);
        return file;
    }
    catch (error) {
        logger.warn(`Could not write cheat file: ${String(error)}`);
        return null;
    }
}
//# sourceMappingURL=cheat-file.js.map