import { deflateSync, inflateSync } from "node:zlib";

type PngColor = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number
];

type PngHeader = {
  bitDepth: number;
  colorType: number;
  compression: number;
  filter: number;
  height: number;
  interlace: number;
  width: number;
};

type DecodedPng = PngHeader & {
  channels: 3 | 4;
  pixels: Buffer;
};

export type AnnotatedPng = {
  bytes: Buffer;
  mimeType: "image/png";
};

export function annotateClickPointOnPng(
  imageBytes: Buffer,
  normalizedX: number,
  normalizedY: number
): AnnotatedPng | null {
  try {
    const png = decodeSimplePng(imageBytes);
    if (!png) return null;

    const x = Math.round(clamp01(normalizedX) * (png.width - 1));
    const y = Math.round(clamp01(normalizedY) * (png.height - 1));
    const radius = Math.max(
      24,
      Math.round(Math.min(png.width, png.height) * 0.035)
    );
    const haloWidth = Math.max(7, Math.round(radius * 0.16));
    const redWidth = Math.max(3, Math.round(radius * 0.08));

    drawCrosshair(
      png,
      x,
      y,
      radius + haloWidth,
      haloWidth,
      [255, 255, 255, 255]
    );
    drawCircle(
      png,
      x,
      y,
      Math.round(radius * 0.55),
      haloWidth,
      [255, 255, 255, 255]
    );
    drawCrosshair(png, x, y, radius, redWidth, [226, 32, 32, 255]);
    drawCircle(
      png,
      x,
      y,
      Math.round(radius * 0.55),
      redWidth,
      [226, 32, 32, 255]
    );
    drawFilledCircle(png, x, y, Math.max(3, redWidth), [226, 32, 32, 255]);

    return { bytes: encodeSimplePng(png), mimeType: "image/png" };
  } catch {
    return null;
  }
}

function decodeSimplePng(
  buffer: Buffer
): DecodedPng | null {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < signature.length ||
    !buffer.subarray(0, 8).equals(signature)
  ) {
    return null;
  }

  let offset = 8;
  let header: PngHeader | null = null;
  const idatChunks: Buffer[] = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12]
      };
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (
    !header ||
    header.bitDepth !== 8 ||
    ![2, 6].includes(header.colorType) ||
    header.compression !== 0 ||
    header.filter !== 0 ||
    header.interlace !== 0 ||
    idatChunks.length === 0
  ) {
    return null;
  }

  const channels: 3 | 4 =
    header.colorType === 6 ? 4 : 3;
  const stride = header.width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = Buffer.alloc(header.width * header.height * channels);
  let sourceOffset = 0;
  let previousRow: Buffer = Buffer.alloc(stride);

  for (let row = 0; row < header.height; row += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const rawRow = inflated.subarray(sourceOffset, sourceOffset + stride);
    sourceOffset += stride;
    const decodedRow = unfilterPngRow(
      rawRow,
      previousRow,
      filter,
      channels
    );
    decodedRow.copy(pixels, row * stride);
    previousRow = decodedRow;
  }

  return {
    ...header,
    channels,
    pixels
  };
}

function unfilterPngRow(
  row: Buffer,
  previousRow: Buffer,
  filter: number,
  bytesPerPixel: number
): Buffer {
  const output = Buffer.alloc(row.length);
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? output[index - bytesPerPixel] : 0;
    const up = previousRow[index] ?? 0;
    const upperLeft =
      index >= bytesPerPixel ? previousRow[index - bytesPerPixel] ?? 0 : 0;
    let value;
    if (filter === 0) {
      value = row[index];
    } else if (filter === 1) {
      value = row[index] + left;
    } else if (filter === 2) {
      value = row[index] + up;
    } else if (filter === 3) {
      value = row[index] + Math.floor((left + up) / 2);
    } else if (filter === 4) {
      value = row[index] + paethPredictor(left, up, upperLeft);
    } else {
      throw new Error(`Unsupported PNG filter ${filter}`);
    }
    output[index] = value & 0xff;
  }
  return output;
}

function paethPredictor(
  left: number,
  up: number,
  upperLeft: number
): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  if (upDistance <= upperLeftDistance) return up;
  return upperLeft;
}

function drawCrosshair(
  png: DecodedPng,
  centerX: number,
  centerY: number,
  radius: number,
  thickness: number,
  color: PngColor
): void {
  drawRect(
    png,
    centerX - radius,
    centerY - Math.floor(thickness / 2),
    radius * 2 + 1,
    thickness,
    color
  );
  drawRect(
    png,
    centerX - Math.floor(thickness / 2),
    centerY - radius,
    thickness,
    radius * 2 + 1,
    color
  );
}

function drawCircle(
  png: DecodedPng,
  centerX: number,
  centerY: number,
  radius: number,
  thickness: number,
  color: PngColor
): void {
  const outer = radius + Math.ceil(thickness / 2);
  const inner = Math.max(0, radius - Math.floor(thickness / 2));
  const outerSquared = outer * outer;
  const innerSquared = inner * inner;
  for (let y = centerY - outer; y <= centerY + outer; y += 1) {
    for (let x = centerX - outer; x <= centerX + outer; x += 1) {
      const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;
      if (
        distanceSquared >= innerSquared &&
        distanceSquared <= outerSquared
      ) {
        setPngPixel(png, x, y, color);
      }
    }
  }
}

function drawFilledCircle(
  png: DecodedPng,
  centerX: number,
  centerY: number,
  radius: number,
  color: PngColor
): void {
  const radiusSquared = radius * radius;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radiusSquared) {
        setPngPixel(png, x, y, color);
      }
    }
  }
}

function drawRect(
  png: DecodedPng,
  x: number,
  y: number,
  width: number,
  height: number,
  color: PngColor
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPngPixel(png, column, row, color);
    }
  }
}

function setPngPixel(
  png: DecodedPng,
  x: number,
  y: number,
  color: PngColor
): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const offset = (y * png.width + x) * png.channels;
  png.pixels[offset] = color[0];
  png.pixels[offset + 1] = color[1];
  png.pixels[offset + 2] = color[2];
  if (png.channels === 4) png.pixels[offset + 3] = color[3];
}

function encodeSimplePng(png: DecodedPng): Buffer {
  const stride = png.width * png.channels;
  const scanlines = Buffer.alloc((stride + 1) * png.height);
  for (let row = 0; row < png.height; row += 1) {
    const targetOffset = row * (stride + 1);
    scanlines[targetOffset] = 0;
    png.pixels.copy(
      scanlines,
      targetOffset + 1,
      row * stride,
      (row + 1) * stride
    );
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(png.width, 0);
  header.writeUInt32BE(png.height, 4);
  header[8] = 8;
  header[9] = png.colorType;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    createPngChunk("IHDR", header),
    createPngChunk("IDAT", deflateSync(scanlines)),
    createPngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createPngChunk(
  type: string,
  data: Buffer
): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(8 + data.length + 4);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(Buffer.concat([typeBuffer, data])),
    8 + data.length
  );
  return chunk;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

const PNG_CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
