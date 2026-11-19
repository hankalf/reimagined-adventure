import QRCode from "qrcode";

export async function qrPng(text: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(text, { type: "png", width: size, margin: 2, errorCorrectionLevel: "M" });
}

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
}

export async function qrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 2, errorCorrectionLevel: "M" });
}
