import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Next 16 corta en 10 MB el cuerpo de toda petición que pasa por proxy.ts (aquí, todas las de
    // /api). Los archivos (PDF del convenio, planos, fotos) viajan como data URL base64, ~33 % más
    // pesados que el original: sin esto, un PDF de más de ~7,5 MB llega truncado y la subida falla.
    proxyClientMaxBodySize: "40mb",
  },
};

export default nextConfig;
