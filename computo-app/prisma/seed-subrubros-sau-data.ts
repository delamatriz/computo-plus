export type SubrubroSeed = {
  codigo: string;
  capitulo: string;
  subcapitulo?: string;
  descripcion: string;
  unidad: string;
  precioUY: number;
  aportesSociales: number;
};

export const SUBRUBROS_SAU: SubrubroSeed[] = [
  // IMPLANTACIÓN Y REPLANTEO
  { codigo: "1.1", capitulo: "Implantación y Replanteo", descripcion: "CARTEL DE OBRA de 4x3m", unidad: "UNI", precioUY: 46834.35, aportesSociales: 3975.07 },
  { codigo: "1.2", capitulo: "Implantación y Replanteo", descripcion: "LIMPIEZA TERRENO SIN RETIRO DE ÁRBOLES", unidad: "M2", precioUY: 55.52, aportesSociales: 20.69 },
  { codigo: "1.3", capitulo: "Implantación y Replanteo", descripcion: "CERCO TEJIDO GALVANIZADO Nº14 H=2.60m", unidad: "ML", precioUY: 1889.21, aportesSociales: 298.13 },
  { codigo: "1.4", capitulo: "Implantación y Replanteo", descripcion: "REPLANTEO GRAL DE OBRA", unidad: "M2", precioUY: 375.91, aportesSociales: 49.69 },
  { codigo: "1.5", capitulo: "Implantación y Replanteo", descripcion: "BARRERA H=2.20 CON TABLAS ENCOFRADO", unidad: "ML", precioUY: 3091.04, aportesSociales: 1055.61 },
  { codigo: "1.6", capitulo: "Implantación y Replanteo", descripcion: "BAÑO QUÍMICO CON LAVAMANOS Y SERVICIO DE BAROMÉTRICA", unidad: "MES", precioUY: 5880.60, aportesSociales: 0 },
  { codigo: "1.7", capitulo: "Implantación y Replanteo", descripcion: "ALQUILER CONTAINER DE 20 PIES CON BAÑO", unidad: "MES", precioUY: 5346.00, aportesSociales: 0 },

  // EXCAVACIONES Y MOVIMIENTOS DE TIERRA
  { codigo: "2.1", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "DESMONTE Y LIMPIEZA A MANO", unidad: "M3", precioUY: 1154.99, aportesSociales: 430.34 },
  { codigo: "2.2", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "EXCAVACIÓN ZANJAS HASTA 1.5M", unidad: "M3", precioUY: 3331.02, aportesSociales: 1241.12 },
  { codigo: "2.3", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "EXCAVACIÓN EN TIERRA HASTA 2M", unidad: "M3", precioUY: 4441.36, aportesSociales: 1654.82 },
  { codigo: "2.4", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "EXCAVACIÓN A MAQUINA SIN RETIRO", unidad: "M3", precioUY: 321.62, aportesSociales: 0 },
  { codigo: "2.5", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "RELLENO DE ZANJAS A MANO", unidad: "M3", precioUY: 1387.93, aportesSociales: 517.13 },
  { codigo: "2.6", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "RELLENO DE POZOS A MANO", unidad: "M3", precioUY: 1943.10, aportesSociales: 723.98 },
  { codigo: "2.7", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "COMPACTACIÓN C/PLANCHA VIBRADORA", unidad: "M3", precioUY: 488.78, aportesSociales: 182.12 },
  { codigo: "2.8", capitulo: "Excavaciones y Movimientos de Tierra", descripcion: "CARGA A MANO CAMIÓN O VOLQUETA", unidad: "M3", precioUY: 416.38, aportesSociales: 155.14 },

  // DEMOLICIONES
  { codigo: "3.1", capitulo: "Demoliciones", descripcion: "DEMOLICIÓN DE LOSA DE HORMIGÓN ARMADO", unidad: "M3", precioUY: 5686.83, aportesSociales: 2118.87 },
  { codigo: "3.2", capitulo: "Demoliciones", descripcion: "DEMOLICIÓN DE VIGAS Y PILARES DE HORMIGÓN ARMADO", unidad: "M3", precioUY: 5998.20, aportesSociales: 2234.88 },
  { codigo: "3.3", capitulo: "Demoliciones", descripcion: "DEMOLICIÓN DE MURO DE HORMIGÓN ARMADO", unidad: "M3", precioUY: 7108.54, aportesSociales: 2648.59 },
  { codigo: "3.4", capitulo: "Demoliciones", descripcion: "DEMOLICIÓN DE MURO MACIZO", unidad: "M3", precioUY: 4389.98, aportesSociales: 1635.67 },
  { codigo: "3.5", capitulo: "Demoliciones", descripcion: "RETIRO DE ABERTURAS", unidad: "M2", precioUY: 633.01, aportesSociales: 235.85 },
  { codigo: "3.6", capitulo: "Demoliciones", descripcion: "PICADO DE REVOQUES EN MUROS (e=3cm)", unidad: "M2", precioUY: 410.94, aportesSociales: 153.11 },
  { codigo: "3.7", capitulo: "Demoliciones", descripcion: "DEMOLICIÓN DE PAVIMENTOS e=10cm", unidad: "M2", precioUY: 521.98, aportesSociales: 194.48 },

  // CIMENTACIONES - MUROS DE CONTENCIÓN
  { codigo: "4.1.1", capitulo: "Cimentaciones", subcapitulo: "Muros de Contención", descripcion: "HORMIGÓN CICLÓPEO ENCOFRADO EN UN LADO", unidad: "M3", precioUY: 14977.77, aportesSociales: 3188.16 },
  { codigo: "4.1.2", capitulo: "Cimentaciones", subcapitulo: "Muros de Contención", descripcion: "HORMIGÓN CICLÓPEO ENCOFRADO DOS LADOS", unidad: "M3", precioUY: 19201.07, aportesSociales: 4388.78 },
  { codigo: "4.1.3", capitulo: "Cimentaciones", subcapitulo: "Muros de Contención", descripcion: "HORMIGÓN ARMADO ENCOFRADO DOS LADOS (140kg de hierro/m3)", unidad: "M3", precioUY: 59055.39, aportesSociales: 14906.51 },
  { codigo: "4.1.4", capitulo: "Cimentaciones", subcapitulo: "Muros de Contención", descripcion: "BLOQUE CEMENTICIO ARMADO e=20cm", unidad: "M3", precioUY: 5029.18, aportesSociales: 1180.37 },

  // CIMENTACIONES - FUNDACIONES
  { codigo: "4.2.1", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "HORMIGÓN POBRE 200K", unidad: "M3", precioUY: 4397.64, aportesSociales: 62.06 },
  { codigo: "4.2.2", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "DADO DE HORMIGÓN CICLÓPEO", unidad: "M3", precioUY: 9031.67, aportesSociales: 1345.64 },
  { codigo: "4.2.3", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "ZAPATA CORRIDA DE HORMIGÓN ARMADO (80kg de hierro/m3)", unidad: "M3", precioUY: 36608.81, aportesSociales: 8487.52 },
  { codigo: "4.2.4", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "PATÍN DE HORMIGÓN ARMADO (80kg de hierro/m3)", unidad: "M3", precioUY: 27361.87, aportesSociales: 5195.94 },
  { codigo: "4.2.5", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "VIGA DE FUNDACIÓN DE HORMIGÓN ARMADO (80kg de hierro/m3)", unidad: "M3", precioUY: 36608.81, aportesSociales: 8487.52 },
  { codigo: "4.2.6", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "PILAR DE FUNDACIÓN DE HORMIGÓN ARMADO (140kg de hierro/m3)", unidad: "M3", precioUY: 58349.43, aportesSociales: 14906.51 },
  { codigo: "4.2.7", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "PLATEA DE HORMIGÓN ARMADO (80kg de hierro/m3)", unidad: "M3", precioUY: 26562.22, aportesSociales: 5195.94 },
  { codigo: "4.2.8", capitulo: "Cimentaciones", subcapitulo: "Fundaciones", descripcion: "DESCALCE DE VIGAS DE FUNDACIÓN CON ARENA", unidad: "ML", precioUY: 318.43, aportesSociales: 103.43 },

  // ESTRUCTURA - PILARES Y VIGAS
  { codigo: "5.1.1", capitulo: "Estructura", subcapitulo: "Pilares y Vigas", descripcion: "PILARES Y PANTALLAS (140kg de hierro/m3)", unidad: "M3", precioUY: 58349.43, aportesSociales: 14906.51 },
  { codigo: "5.1.2", capitulo: "Estructura", subcapitulo: "Pilares y Vigas", descripcion: "PILARES CURVOS (140kg de hierro/m3)", unidad: "M3", precioUY: 71685.33, aportesSociales: 19875.34 },
  { codigo: "5.1.3", capitulo: "Estructura", subcapitulo: "Pilares y Vigas", descripcion: "VIGAS Y CARRERAS (120kg de hierro/m3)", unidad: "M3", precioUY: 51845.57, aportesSociales: 13044.83 },

  // ESTRUCTURA - LOSAS
  { codigo: "5.2.1", capitulo: "Estructura", subcapitulo: "Losas", descripcion: "LOSA PREFABRICADA STALTON CON BOVEDILLA H=10cm", unidad: "M2", precioUY: 3828.81, aportesSociales: 703.74 },
  { codigo: "5.2.2", capitulo: "Estructura", subcapitulo: "Losas", descripcion: "LOSA PREFABRICADA STALTON CON BOVEDILLA H=15cm", unidad: "M2", precioUY: 4026.02, aportesSociales: 703.74 },
  { codigo: "5.2.3", capitulo: "Estructura", subcapitulo: "Losas", descripcion: "LOSA PREFABRICADA STALTON CON BOVEDILLA H=19cm", unidad: "M2", precioUY: 5923.26, aportesSociales: 703.74 },
  { codigo: "5.2.4", capitulo: "Estructura", subcapitulo: "Losas", descripcion: "LOSA DE HORMIGÓN ARMADO e=15cm (80kg de hierro/m3)", unidad: "M3", precioUY: 44866.32, aportesSociales: 11264.16 },

  // ESTRUCTURA - HORMIGONES VARIOS
  { codigo: "5.3.1", capitulo: "Estructura", subcapitulo: "Hormigones Varios", descripcion: "HORMIGÓN PREMEZCLADO BOMBEADO C20", unidad: "M3", precioUY: 6652.80, aportesSociales: 0 },
  { codigo: "5.3.2", capitulo: "Estructura", subcapitulo: "Hormigones Varios", descripcion: "HORMIGÓN PREMEZCLADO VOLCADO C20", unidad: "M3", precioUY: 5940.00, aportesSociales: 0 },
  { codigo: "5.3.3", capitulo: "Estructura", subcapitulo: "Hormigones Varios", descripcion: "ANTEPECHO DE HORMIGÓN ARMADO (80kg de hierro/m3)", unidad: "M3", precioUY: 49090.34, aportesSociales: 12837.98 },
  { codigo: "5.3.4", capitulo: "Estructura", subcapitulo: "Hormigones Varios", descripcion: "DINTEL DE HORMIGÓN ARMADO (80kg de hierro/m3)", unidad: "M3", precioUY: 52982.44, aportesSociales: 14288.14 },
  { codigo: "5.3.5", capitulo: "Estructura", subcapitulo: "Hormigones Varios", descripcion: "TANQUE DE AGUA (80kg de hierro/m3)", unidad: "M3", precioUY: 57764.90, aportesSociales: 15156.04 },
  { codigo: "5.3.6", capitulo: "Estructura", subcapitulo: "Hormigones Varios", descripcion: "LOSA DE ESCALERA RECTA (80kg de hierro/m3)", unidad: "M3", precioUY: 61309.99, aportesSociales: 17390.93 },

  // ALBAÑILERÍA - ELEVACIÓN DE MUROS - LADRILLO DE CAMPO
  { codigo: "6.1.1", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "MURO DOBLE e=30cm CON 1 CARA VISTA", unidad: "M2", precioUY: 7192.58, aportesSociales: 1713.34 },
  { codigo: "6.1.2", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "MURO e=25cm A REVOCAR", unidad: "M2", precioUY: 4863.51, aportesSociales: 927.66 },
  { codigo: "6.1.3", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "MURO e=19cm A REVOCAR", unidad: "M2", precioUY: 3836.47, aportesSociales: 728.91 },
  { codigo: "6.1.4", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "MURO e=12cm CON 1 CARA VISTA", unidad: "M2", precioUY: 4339.42, aportesSociales: 1056.82 },
  { codigo: "6.1.5", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "MURO e=12cm A REVOCAR", unidad: "M2", precioUY: 2852.25, aportesSociales: 629.53 },
  { codigo: "6.1.6", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "MURO e=5.5cm A REVOCAR", unidad: "M2", precioUY: 1705.68, aportesSociales: 393.46 },
  { codigo: "6.1.7", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "APLACADO DE MURO CON CHORIZO", unidad: "M2", precioUY: 3221.18, aportesSociales: 828.28 },
  { codigo: "6.1.8", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Campo", descripcion: "APLACADO DE MURO CON LADRILLO A ESPEJO", unidad: "M2", precioUY: 2575.88, aportesSociales: 650.22 },

  // ALBAÑILERÍA - ELEVACIÓN DE MUROS - TICHOLOS
  { codigo: "6.1.9", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ticholos", descripcion: "MURO e=8cm DE (8X25X25cm)", unidad: "M2", precioUY: 1729.63, aportesSociales: 364.46 },
  { codigo: "6.1.10", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ticholos", descripcion: "MURO e=12cm (12X25X25CM)", unidad: "M2", precioUY: 1754.62, aportesSociales: 364.46 },
  { codigo: "6.1.11", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ticholos", descripcion: "MURO e=17cm (17X25X25)", unidad: "M2", precioUY: 2572.41, aportesSociales: 393.46 },
  { codigo: "6.1.12", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ticholos", descripcion: "MURO e=25cm (12X25X25cm)", unidad: "M2", precioUY: 2997.25, aportesSociales: 550.84 },

  // ALBAÑILERÍA - ELEVACIÓN DE MUROS - BLOQUE HORMIGÓN
  { codigo: "6.1.13", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Bloque Hormigón", descripcion: "MURO e=20cm (19x19x39cm)", unidad: "M2", precioUY: 2590.33, aportesSociales: 513.52 },
  { codigo: "6.1.14", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Bloque Hormigón", descripcion: "MURO e=20cm DOS CARAS VISTAS (19x19x39cm)", unidad: "M2", precioUY: 2957.21, aportesSociales: 650.22 },
  { codigo: "6.1.15", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Bloque Hormigón", descripcion: "MURO e=12cm (12x19x39cm)", unidad: "M2", precioUY: 1945.10, aportesSociales: 455.51 },
  { codigo: "6.1.16", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Bloque Hormigón", descripcion: "MURO e=12cm DOS CARAS VISTAS (12x19x39cm)", unidad: "M2", precioUY: 2334.31, aportesSociales: 600.53 },

  // ALBAÑILERÍA - ELEVACIÓN DE MUROS - LADRILLO DE VIDRIO
  { codigo: "6.1.17", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Vidrio", descripcion: "MURO DE LADRILLO DE VIDRIO DE 19x19X8cm", unidad: "M2", precioUY: 5851.91, aportesSociales: 1024.11 },
  { codigo: "6.1.18", capitulo: "Albañilería", subcapitulo: "Elevación de Muros — Ladrillo de Vidrio", descripcion: "ACUÑADO DE MUROS CON POLIURETANO", unidad: "ML", precioUY: 90.09, aportesSociales: 4.93 },

  // ALBAÑILERÍA - REVOQUES - CIELORRASO
  { codigo: "6.2.1", capitulo: "Albañilería", subcapitulo: "Revoques — Cielorraso", descripcion: "AZOTADA Y REVOQUE GRUESO PARA CIELORRASO", unidad: "M2", precioUY: 1158.82, aportesSociales: 364.46 },
  { codigo: "6.2.2", capitulo: "Albañilería", subcapitulo: "Revoques — Cielorraso", descripcion: "REVOQUE FINO PARA CIELORRASO", unidad: "M2", precioUY: 540.12, aportesSociales: 186.39 },
  { codigo: "6.2.3", capitulo: "Albañilería", subcapitulo: "Revoques — Cielorraso", descripcion: "BALAI PARA CIELORRASO", unidad: "M2", precioUY: 682.25, aportesSociales: 236.08 },

  // ALBAÑILERÍA - REVOQUES - MUROS INTERIORES
  { codigo: "6.2.4", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Interiores", descripcion: "REVOQUE GRUESO MURO INTERIOR", unidad: "M2", precioUY: 886.57, aportesSociales: 277.45 },
  { codigo: "6.2.5", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Interiores", descripcion: "REVOQUE FINO MURO INTERIOR", unidad: "M2", precioUY: 406.77, aportesSociales: 136.70 },
  { codigo: "6.2.6", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Interiores", descripcion: "REVOQUE ARENA Y PORTLAND LUSTRADO", unidad: "M2", precioUY: 927.12, aportesSociales: 314.76 },
  { codigo: "6.2.7", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Interiores", descripcion: "BALAI EN MURO INTERIOR", unidad: "M2", precioUY: 573.87, aportesSociales: 196.73 },

  // ALBAÑILERÍA - REVOQUES - MUROS EXTERIORES
  { codigo: "6.2.8", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Exteriores", descripcion: "CAPA HIDROFUGADA PARA MURO EXTERIOR", unidad: "M2", precioUY: 525.78, aportesSociales: 157.38 },
  { codigo: "6.2.9", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Exteriores", descripcion: "REVOQUE GRUESO MURO EXTERIOR", unidad: "M2", precioUY: 831.05, aportesSociales: 256.76 },
  { codigo: "6.2.10", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Exteriores", descripcion: "REVOQUE FINO MURO EXTERIOR", unidad: "M2", precioUY: 680.68, aportesSociales: 236.08 },
  { codigo: "6.2.11", capitulo: "Albañilería", subcapitulo: "Revoques — Muros Exteriores", descripcion: "BALAI EN FACHADA CON MEZCLA FINA SOBRE GRUESO", unidad: "M2", precioUY: 567.88, aportesSociales: 196.73 },

  // ALBAÑILERÍA - REVOQUES - OTROS
  { codigo: "6.2.12", capitulo: "Albañilería", subcapitulo: "Revoques — Otros", descripcion: "AZOTADA PARA MORDIENTE EN PARAMENTO", unidad: "M2", precioUY: 320.47, aportesSociales: 107.70 },
  { codigo: "6.2.13", capitulo: "Albañilería", subcapitulo: "Revoques — Otros", descripcion: "MOCHETA INTERIOR COMPLETA (15x15cm)", unidad: "ML", precioUY: 1307.28, aportesSociales: 393.46 },
  { codigo: "6.2.14", capitulo: "Albañilería", subcapitulo: "Revoques — Otros", descripcion: "MOCHETA EXTERIOR COMPLETA (15X15CM)", unidad: "ML", precioUY: 1382.60, aportesSociales: 472.15 },
  { codigo: "6.2.15", capitulo: "Albañilería", subcapitulo: "Revoques — Otros", descripcion: "BUÑAS", unidad: "ML", precioUY: 311.37, aportesSociales: 116.01 },
  { codigo: "6.2.16", capitulo: "Albañilería", subcapitulo: "Revoques — Otros", descripcion: "ARENA Y PORTLAND LUSTRADO PARA TANQUES DE AGUA", unidad: "M2", precioUY: 1405.03, aportesSociales: 492.84 },

  // ALBAÑILERÍA - CONTRAPISOS
  { codigo: "6.3.1", capitulo: "Albañilería", subcapitulo: "Contrapisos", descripcion: "CONTRAPISO SOBRE TIERRA DE BALASTO 10cm", unidad: "M2", precioUY: 1018.19, aportesSociales: 205.55 },
  { codigo: "6.3.2", capitulo: "Albañilería", subcapitulo: "Contrapisos", descripcion: "CONTRAPISO SOBRE LOSA DE HORMIGÓN e=5cm", unidad: "M2", precioUY: 624.48, aportesSociales: 149.07 },
  { codigo: "6.3.3", capitulo: "Albañilería", subcapitulo: "Contrapisos", descripcion: "CONTRAPISO SOBRE LOSA DE BAÑO e=20cm", unidad: "M2", precioUY: 1333.09, aportesSociales: 149.07 },
  { codigo: "6.3.4", capitulo: "Albañilería", subcapitulo: "Contrapisos", descripcion: "ALISADO DE ARENA Y PORTLAND e=2cm", unidad: "M2", precioUY: 575.57, aportesSociales: 173.91 },
  { codigo: "6.3.5", capitulo: "Albañilería", subcapitulo: "Contrapisos", descripcion: "COLOCACIÓN DE MALLA ELECTROSOLDADA 15x15x4,2mm", unidad: "M2", precioUY: 205.82, aportesSociales: 4.97 },
  { codigo: "6.3.6", capitulo: "Albañilería", subcapitulo: "Contrapisos", descripcion: "HORMIGÓN POROSO EN AZOTEA e=12cm", unidad: "M2", precioUY: 5658.22, aportesSociales: 1540.56 },

  // ALBAÑILERÍA - PISOS ZÓCALOS Y OTROS
  { codigo: "6.4.1", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "PISO VINÍLICO H2O EN TABLAS E=8mm", unidad: "M2", precioUY: 2661.12, aportesSociales: 0 },
  { codigo: "6.4.2", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "PISO VINÍLICO EN ROLLO", unidad: "M2", precioUY: 556.37, aportesSociales: 0 },
  { codigo: "6.4.3", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "BALDOSAS VINÍLICAS DE 30X30cm", unidad: "M2", precioUY: 2109.18, aportesSociales: 0 },
  { codigo: "6.4.4", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "PISO FLOTANTE ALTA CALIDAD COLOCADO", unidad: "M2", precioUY: 2177.13, aportesSociales: 0 },
  { codigo: "6.4.5", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "PARQUET COLOCADO", unidad: "M2", precioUY: 3147.49, aportesSociales: 145.02 },
  { codigo: "6.4.6", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "PORCELANATO 60x60cm", unidad: "M2", precioUY: 2717.55, aportesSociales: 521.84 },
  { codigo: "6.4.7", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "BALDOSA CERÁMICA 50x50cm", unidad: "M2", precioUY: 2021.14, aportesSociales: 521.84 },
  { codigo: "6.4.8", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "BALDOSA DE MONOLÍTICA 40x40cm", unidad: "M2", precioUY: 3287.16, aportesSociales: 521.84 },
  { codigo: "6.4.9", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ALFOMBRA DE ALTO TRÁNSITO", unidad: "M2", precioUY: 1191.81, aportesSociales: 0 },
  { codigo: "6.4.10", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "BALDOSA DE VEREDA 20x20cm", unidad: "M2", precioUY: 1577.56, aportesSociales: 314.76 },
  { codigo: "6.4.11", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "PULIDO DE PISO DE MADERA Y PLASTIFICADO", unidad: "M2", precioUY: 594.00, aportesSociales: 0 },
  { codigo: "6.4.12", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "PULIDO DE PISO DE MONOLÍTICO", unidad: "M2", precioUY: 831.60, aportesSociales: 0 },
  { codigo: "6.4.13", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "UMBRAL DE GRANITO GRIS 0.90x0.30m", unidad: "M2", precioUY: 4779.66, aportesSociales: 615.48 },
  { codigo: "6.4.14", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "UMBRAL DE PORTLAND LUSTRADO ancho=30cm", unidad: "ML", precioUY: 583.41, aportesSociales: 205.16 },
  { codigo: "6.4.15", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "NARIZ DE MADERA DURA 10x5cm", unidad: "ML", precioUY: 962.22, aportesSociales: 306.89 },
  { codigo: "6.4.16", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ENTREPUERTA DE MADERA DURA e=2\"", unidad: "ML", precioUY: 12338.12, aportesSociales: 513.74 },
  { codigo: "6.4.17", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ENTREPUERTA DE GRANITO GRIS DE 1.50x0.70m", unidad: "M2", precioUY: 13227.32, aportesSociales: 820.64 },
  { codigo: "6.4.18", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ESCALÓN DE GRANITO GRIS", unidad: "M2", precioUY: 10405.47, aportesSociales: 1027.50 },
  { codigo: "6.4.19", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ESCALÓN DE MADERA DURA e=2\"", unidad: "ML", precioUY: 12338.12, aportesSociales: 513.74 },
  { codigo: "6.4.20", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ESCALÓN DE ARENA Y PORTLAND LUSTRADO h=7cm", unidad: "ML", precioUY: 1220.97, aportesSociales: 431.00 },
  { codigo: "6.4.21", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ZÓCALO DE MADERA DE 75mmx15mm", unidad: "ML", precioUY: 716.72, aportesSociales: 102.78 },
  { codigo: "6.4.22", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ZÓCALO DE BALDOSA CERÁMICA 50x50cm h=12cm", unidad: "ML", precioUY: 499.99, aportesSociales: 130.46 },
  { codigo: "6.4.23", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ZÓCALO DE BALDOSA DE MONOLÍTICA 40x40cm h=12cm", unidad: "ML", precioUY: 694.67, aportesSociales: 118.04 },
  { codigo: "6.4.24", capitulo: "Albañilería", subcapitulo: "Pisos, Zócalos y Otros", descripcion: "ZÓCALO PORCELANATO h=12cm", unidad: "ML", precioUY: 912.92, aportesSociales: 196.73 },

  // ALBAÑILERÍA - REVESTIMIENTOS
  { codigo: "6.5.1", capitulo: "Albañilería", subcapitulo: "Revestimientos", descripcion: "PORCELANATO PULIDO 60X60", unidad: "M2", precioUY: 2385.94, aportesSociales: 543.76 },
  { codigo: "6.5.2", capitulo: "Albañilería", subcapitulo: "Revestimientos", descripcion: "PORCELANATO MATE BLANCO 30X60", unidad: "M2", precioUY: 2569.22, aportesSociales: 543.76 },
  { codigo: "6.5.3", capitulo: "Albañilería", subcapitulo: "Revestimientos", descripcion: "PORCELANATO CON TEXTURA Y/O DISEÑO 60X60cm", unidad: "M2", precioUY: 2569.22, aportesSociales: 543.76 },
  { codigo: "6.5.4", capitulo: "Albañilería", subcapitulo: "Revestimientos", descripcion: "CERÁMICA 45x45cm SOBRE RÚSTICO", unidad: "M2", precioUY: 2385.46, aportesSociales: 820.64 },

  // ALBAÑILERÍA - IMPERMEABILIZACIONES Y AISLACIONES
  { codigo: "6.6.1", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "CONFORMACIÓN DE MEDIA CAÑA", unidad: "ML", precioUY: 774.72, aportesSociales: 281.49 },
  { codigo: "6.6.2", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "CAPA ALISADO DE ARENA Y PÓRTLAND 2cm", unidad: "M2", precioUY: 751.94, aportesSociales: 236.08 },
  { codigo: "6.6.3", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "CONTRAPISO SOBRE LOSA DE HORMIGÓN e=5cm", unidad: "M2", precioUY: 624.48, aportesSociales: 149.07 },
  { codigo: "6.6.4", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "BARRERA DE VAPOR (POLIETILENO 100 MICRONES)", unidad: "M2", precioUY: 59.52, aportesSociales: 10.34 },
  { codigo: "6.6.5", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "POLIURETANO EXPANDIDO SOBRE LOSA Y MURO e=3cm", unidad: "M2", precioUY: 509.64, aportesSociales: 0 },
  { codigo: "6.6.6", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "ESPUMA PLAST AUTOTRABANTE SOBRE LOSAS e=2.5cm", unidad: "M2", precioUY: 412.78, aportesSociales: 49.69 },
  { codigo: "6.6.7", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "PAPEL CRAFT", unidad: "M2", precioUY: 24.57, aportesSociales: 6.21 },
  { codigo: "6.6.8", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "MEMBRANA CON GEOTEXTIL", unidad: "M2", precioUY: 1217.29, aportesSociales: 198.75 },
  { codigo: "6.6.9", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "MEMBRANA CON ALUMINIO DE 4mm", unidad: "M2", precioUY: 971.05, aportesSociales: 198.75 },
  { codigo: "6.6.10", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "IMPRIMACIÓN CON CEPOL", unidad: "M2", precioUY: 53.29, aportesSociales: 10.34 },
  { codigo: "6.6.11", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "IMPERMEABILIZACIÓN DE BAÑO EN PLANTA ALTA", unidad: "M2", precioUY: 528.76, aportesSociales: 132.43 },
  { codigo: "6.6.12", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "IMPERMEABILIZACIÓN HORIZONTAL DE CIMIENTOS", unidad: "M2", precioUY: 587.37, aportesSociales: 142.88 },
  { codigo: "6.6.13", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "COLOCACIÓN DE TEJAS COLONIALES", unidad: "M2", precioUY: 2266.21, aportesSociales: 347.82 },
  { codigo: "6.6.15", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "INFILTRACIÓN DE MUROS DE 15cm BASE ACUOSA", unidad: "ML", precioUY: 2135.21, aportesSociales: 206.85 },
  { codigo: "6.6.16", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "INFILTRACIÓN DE MUROS DE 30cm BASE DILUYENTE", unidad: "ML", precioUY: 4270.42, aportesSociales: 413.71 },
  { codigo: "6.6.17", capitulo: "Albañilería", subcapitulo: "Impermeabilizaciones y Aislaciones", descripcion: "SUBMURACIÓN CON CORTE DE MURO DE 15cm", unidad: "M2", precioUY: 4499.55, aportesSociales: 1136.65 },

  // SUBCONTRATOS - PINTURAS - PREPARACIÓN
  { codigo: "7.1.1", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE ENDUIDO PLASTICO EN TECHOS INTERIORES", unidad: "M2", precioUY: 348.36, aportesSociales: 122.76 },
  { codigo: "7.1.2", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE ENDUIDO PLASTICO EN TECHOS EXTERIORES", unidad: "M2", precioUY: 425.20, aportesSociales: 122.76 },
  { codigo: "7.1.3", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE ENDUIDO PLASTICO EN MUROS INTERIORES", unidad: "M2", precioUY: 270.69, aportesSociales: 92.07 },
  { codigo: "7.1.4", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE ENDUIDO PLASTICO EN MUROS EXTERIORES", unidad: "M2", precioUY: 425.20, aportesSociales: 122.76 },
  { codigo: "7.1.5", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE FIJADOR PARA MUROS", unidad: "M2", precioUY: 103.67, aportesSociales: 30.69 },
  { codigo: "7.1.6", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE IMPRIMACIÓN PARA MUROS", unidad: "M2", precioUY: 108.64, aportesSociales: 30.69 },
  { codigo: "7.1.7", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE FONDO PARA MADERA", unidad: "M2", precioUY: 230.61, aportesSociales: 46.03 },
  { codigo: "7.1.8", capitulo: "Subcontratos - Pinturas", subcapitulo: "Preparación", descripcion: "APLICACIÓN DE ANTIÓXIDO PARA HIERRO", unidad: "M2", precioUY: 539.02, aportesSociales: 92.07 },

  // SUBCONTRATOS - PINTURAS - CIELORRASOS
  { codigo: "7.1.9", capitulo: "Subcontratos - Pinturas", subcapitulo: "Cielorrasos", descripcion: "PINTURA LATEX SOBRE TERCIADA O FINA EN CIELORRASOS", unidad: "M2", precioUY: 440.05, aportesSociales: 107.41 },
  { codigo: "7.1.10", capitulo: "Subcontratos - Pinturas", subcapitulo: "Cielorrasos", descripcion: "PINTURA A LA CAL EN CIELORRASOS", unidad: "M2", precioUY: 263.39, aportesSociales: 92.07 },
  { codigo: "7.1.11", capitulo: "Subcontratos - Pinturas", subcapitulo: "Cielorrasos", descripcion: "PINTURA ANTIHONGOS SOBRE ENDUIDO EN CIELORRASO", unidad: "M2", precioUY: 375.48, aportesSociales: 107.41 },

  // SUBCONTRATOS - PINTURAS - MUROS INTERIORES
  { codigo: "7.1.12", capitulo: "Subcontratos - Pinturas", subcapitulo: "Muros Interiores", descripcion: "PINTURA LATEX SOBRE ENDUIDO EN MURO INTERIOR", unidad: "M2", precioUY: 422.00, aportesSociales: 92.07 },
  { codigo: "7.1.13", capitulo: "Subcontratos - Pinturas", subcapitulo: "Muros Interiores", descripcion: "PINTURA A LA CAL EN MUROS", unidad: "M2", precioUY: 263.39, aportesSociales: 92.07 },

  // SUBCONTRATOS - PINTURAS - MUROS EXTERIORES
  { codigo: "7.1.14", capitulo: "Subcontratos - Pinturas", subcapitulo: "Muros Exteriores", descripcion: "PINTURA LATEX SOBRE BALAI PARA MURO EXTERIOR", unidad: "M2", precioUY: 603.44, aportesSociales: 184.14 },
  { codigo: "7.1.15", capitulo: "Subcontratos - Pinturas", subcapitulo: "Muros Exteriores", descripcion: "PINTURA LATEX SIN ENDUIDO PARA MURO EXTERIOR", unidad: "M2", precioUY: 503.08, aportesSociales: 122.76 },
  { codigo: "7.1.16", capitulo: "Subcontratos - Pinturas", subcapitulo: "Muros Exteriores", descripcion: "IMPERMEABILIZANTE A BASE DE SILICONAS HIDROREPELENTE", unidad: "M2", precioUY: 740.86, aportesSociales: 153.45 },
  { codigo: "7.1.17", capitulo: "Subcontratos - Pinturas", subcapitulo: "Muros Exteriores", descripcion: "ESMALTE SINTÉTICO", unidad: "M2", precioUY: 1562.12, aportesSociales: 513.74 },
  { codigo: "7.1.18", capitulo: "Subcontratos - Pinturas", subcapitulo: "Muros Exteriores", descripcion: "BARNIZ", unidad: "M2", precioUY: 1729.64, aportesSociales: 513.74 },

  // SUBCONTRATOS - ACONDICIONAMIENTOS
  { codigo: "7.2.1", capitulo: "Subcontratos - Acondicionamientos", descripcion: "BAÑO COMPLETO", unidad: "GL", precioUY: 86071.36, aportesSociales: 28756.18 },
  { codigo: "7.2.2", capitulo: "Subcontratos - Acondicionamientos", descripcion: "COCINA COMPLETA", unidad: "GL", precioUY: 59033.06, aportesSociales: 18885.95 },
  { codigo: "7.2.3", capitulo: "Subcontratos - Acondicionamientos", descripcion: "INODORO CON MOCHILA BIDET Y LAVABO BLANCO", unidad: "GL", precioUY: 9997.51, aportesSociales: 0 },
  { codigo: "7.2.4", capitulo: "Subcontratos - Acondicionamientos", descripcion: "JUEGO DE GRIFERÍA MONOCOMANDO", unidad: "GL", precioUY: 5348.92, aportesSociales: 0 },
  { codigo: "7.2.5", capitulo: "Subcontratos - Acondicionamientos", descripcion: "PILETA Y MEDIA DE COCINA DE ACERO INOXIDABLE", unidad: "GL", precioUY: 5348.92, aportesSociales: 0 },
  { codigo: "7.2.6", capitulo: "Subcontratos - Acondicionamientos", descripcion: "MEZCLADORA COCINA", unidad: "GL", precioUY: 2468.39, aportesSociales: 0 },
  { codigo: "7.2.8", capitulo: "Subcontratos - Acondicionamientos", descripcion: "CÁMARA DE INSPECCIÓN CON TAPA Y CONTRATAPA 60x60cm", unidad: "GL", precioUY: 2160.00, aportesSociales: 0 },
  { codigo: "7.2.10", capitulo: "Subcontratos - Acondicionamientos", descripcion: "GRANITO GRIS MESADA", unidad: "M2", precioUY: 12417.30, aportesSociales: 0 },
  { codigo: "7.2.11", capitulo: "Subcontratos - Acondicionamientos", descripcion: "GRANITO NEGRO ABSOLUTO MESADA", unidad: "M2", precioUY: 21727.61, aportesSociales: 0 },
  { codigo: "7.2.12", capitulo: "Subcontratos - Acondicionamientos", descripcion: "MÁRMOL TRAVERTINO MESADA", unidad: "M2", precioUY: 13948.20, aportesSociales: 0 },
  { codigo: "7.2.13", capitulo: "Subcontratos - Acondicionamientos", descripcion: "MÁRMOL BLANCO CARRARA MESADA", unidad: "M2", precioUY: 15223.95, aportesSociales: 0 },
  { codigo: "7.2.14", capitulo: "Subcontratos - Acondicionamientos", descripcion: "SILESTONE BLANCO MESADA", unidad: "M2", precioUY: 16963.83, aportesSociales: 0 },
  { codigo: "7.2.15", capitulo: "Subcontratos - Acondicionamientos", descripcion: "DEKTON NATURA MESADA", unidad: "M2", precioUY: 25054.63, aportesSociales: 0 },
  { codigo: "7.2.16", capitulo: "Subcontratos - Acondicionamientos", descripcion: "AMURE DE MESADA", unidad: "M2", precioUY: 776.69, aportesSociales: 306.89 },
  { codigo: "7.2.17", capitulo: "Subcontratos - Acondicionamientos", descripcion: "VALOR MEDIO PUESTA ELÉCTRICA O DE DATOS", unidad: "UNI", precioUY: 4498.20, aportesSociales: 0 },
  { codigo: "7.2.18", capitulo: "Subcontratos - Acondicionamientos", descripcion: "PISO TÉCNICO CON COLOCACIÓN", unidad: "M2", precioUY: 5103.00, aportesSociales: 0 },
  { codigo: "7.2.19", capitulo: "Subcontratos - Acondicionamientos", descripcion: "EQUIPO SPLIT 9000BTU INVERTER CON INSTALACIÓN", unidad: "GL", precioUY: 27805.57, aportesSociales: 0 },
  { codigo: "7.2.20", capitulo: "Subcontratos - Acondicionamientos", descripcion: "EQUIPO SPLIT 12000BTU INVERTER CON INSTALACIÓN", unidad: "GL", precioUY: 30195.74, aportesSociales: 0 },
  { codigo: "7.2.21", capitulo: "Subcontratos - Acondicionamientos", descripcion: "CORTINA TIPO BLACKOUT MANUAL", unidad: "M2", precioUY: 3188.16, aportesSociales: 0 },
  { codigo: "7.2.22", capitulo: "Subcontratos - Acondicionamientos", descripcion: "CORTINA VENECIANA PARA INTERIOR MANUAL", unidad: "M2", precioUY: 11226.60, aportesSociales: 0 },
  { codigo: "7.2.23", capitulo: "Subcontratos - Acondicionamientos", descripcion: "CÉSPED ARTIFICIAL H=20MM", unidad: "GL", precioUY: 941.76, aportesSociales: 0 },
  { codigo: "7.2.24", capitulo: "Subcontratos - Acondicionamientos", descripcion: "DECK DE MADERA", unidad: "M2", precioUY: 3240.00, aportesSociales: 0 },
  { codigo: "7.2.25", capitulo: "Subcontratos - Acondicionamientos", descripcion: "BALDOSAS GREEN BLOCK", unidad: "M2", precioUY: 589.68, aportesSociales: 0 },
  { codigo: "7.2.26", capitulo: "Subcontratos - Acondicionamientos", descripcion: "BALDOSA DE CAUCHO RECICLADO 50X50cm", unidad: "M2", precioUY: 4262.76, aportesSociales: 0 },
  { codigo: "7.2.27", capitulo: "Subcontratos - Acondicionamientos", descripcion: "PISCINA DE 7.5x3.5x1.4m DE POLIESTER", unidad: "UNI", precioUY: 385900.58, aportesSociales: 0 },
  { codigo: "7.2.28", capitulo: "Subcontratos - Acondicionamientos", descripcion: "TOLDO VERTICAL EXTERIOR MANUAL", unidad: "M2", precioUY: 4301.10, aportesSociales: 0 },
  { codigo: "7.2.29", capitulo: "Subcontratos - Acondicionamientos", descripcion: "CORTINA VENECIANA PARA EXTERIOR MANUAL", unidad: "M2", precioUY: 11226.60, aportesSociales: 0 },
  { codigo: "7.2.30", capitulo: "Subcontratos - Acondicionamientos", descripcion: "ASCENSOR PARA 8 PERSONAS 12 PARADAS", unidad: "GL", precioUY: 1853258.40, aportesSociales: 0 },
  { codigo: "7.2.31", capitulo: "Subcontratos - Acondicionamientos", descripcion: "ASCENSOR PARA 6 PERSONAS 5 PARADAS", unidad: "GL", precioUY: 1340463.60, aportesSociales: 0 },

  // SUBCONTRATOS - CARPINTERÍAS - MADERA
  { codigo: "7.3.1", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Madera", descripcion: "PUERTA EXTERIOR CON MARCO DE 0.90x2.10m", unidad: "UNI", precioUY: 69120.00, aportesSociales: 0 },
  { codigo: "7.3.2", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Madera", descripcion: "PUERTA INTERIOR CON MARCO DE 0.8x2.05m", unidad: "UNI", precioUY: 15660.00, aportesSociales: 0 },
  { codigo: "7.3.3", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Madera", descripcion: "VENTANA CORREDIZA DE MADERA CON CELOSÍA 1.20x1.00m", unidad: "UNI", precioUY: 15743.70, aportesSociales: 0 },
  { codigo: "7.3.4", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Madera", descripcion: "PUERTA VENTANA CORREDIZA DE MADERA 1.80x2.05m", unidad: "UNI", precioUY: 40483.80, aportesSociales: 0 },
  { codigo: "7.3.5", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Madera", descripcion: "AMURE DE ABERTURAS DE MADERA", unidad: "M2", precioUY: 2535.33, aportesSociales: 993.77 },

  // SUBCONTRATOS - HERRAJES
  { codigo: "7.3.6", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Herrajes", descripcion: "POMO CON LLAVIN", unidad: "UNI", precioUY: 345.60, aportesSociales: 0 },
  { codigo: "7.3.7", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Herrajes", descripcion: "CERRADURA TIPO STAR CON MANIJA", unidad: "UNI", precioUY: 1782.00, aportesSociales: 0 },
  { codigo: "7.3.8", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Herrajes", descripcion: "BISAGRA", unidad: "UNI", precioUY: 126.36, aportesSociales: 0 },

  // SUBCONTRATOS - EQUIPAMIENTO
  { codigo: "7.3.9", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Equipamiento", descripcion: "MUEBLE DE BAÑO CON BACHA 0.75x0.50x0.65m", unidad: "UNI", precioUY: 15743.70, aportesSociales: 0 },
  { codigo: "7.3.10", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Equipamiento", descripcion: "MUEBLE COCINA MODULADO METRO LINEAL", unidad: "UNI", precioUY: 23390.64, aportesSociales: 0 },
  { codigo: "7.3.11", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Equipamiento", descripcion: "PLACARD DE PUERTAS CORREDIZAS 1.80X2.30X0.65m", unidad: "UNI", precioUY: 58476.60, aportesSociales: 0 },

  // SUBCONTRATOS - CARPINTERÍA DE HIERRO
  { codigo: "7.3.12", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Hierro", descripcion: "VENTANA EN PERFIL DE HIERRO 1.40x1.10m", unidad: "UNI", precioUY: 13800.94, aportesSociales: 0 },
  { codigo: "7.3.13", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Hierro", descripcion: "REJA 1.40x1.10mm", unidad: "UNI", precioUY: 9573.23, aportesSociales: 0 },
  { codigo: "7.3.14", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Hierro", descripcion: "PUERTA DE CHAPA CALIBRE 18 0.75x2.05m", unidad: "UNI", precioUY: 14580.00, aportesSociales: 0 },
  { codigo: "7.3.15", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Hierro", descripcion: "PORTÓN DE GARAGE DOS HOJAS 2.40x2.10m", unidad: "UNI", precioUY: 51388.67, aportesSociales: 0 },
  { codigo: "7.3.16", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Hierro", descripcion: "MOTOR PARA PORTÓN BATIENTE", unidad: "UNI", precioUY: 37908.00, aportesSociales: 0 },
  { codigo: "7.3.17", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Hierro", descripcion: "AMURE DE ABERTURAS O REJAS", unidad: "M2", precioUY: 2535.33, aportesSociales: 993.77 },

  // SUBCONTRATOS - CARPINTERÍA DE ALUMINIO
  { codigo: "7.3.17b", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "PUERTA VENTANA CORREDIZA ALUMINIO SERIE 25 2.00X2.05m", unidad: "UNI", precioUY: 19519.67, aportesSociales: 0 },
  { codigo: "7.3.18", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "VENTANA CORREDIZA ALUMINIO SERIE 25 1.20X1.10m", unidad: "UNI", precioUY: 9560.66, aportesSociales: 0 },
  { codigo: "7.3.19", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "PUERTA VENTANA CORREDIZA ALUMINIO SERIE GALA DVH 2.80x2.05m", unidad: "UNI", precioUY: 58559.01, aportesSociales: 0 },
  { codigo: "7.3.20", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "PUERTA BATIENTE ALUMINIO SERIE GALA 0.90x2.05m", unidad: "UNI", precioUY: 28283.60, aportesSociales: 0 },
  { codigo: "7.3.21", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "VENTANA OSCILOBATIENTE ALUMINIO SERIE GALA 1.40x1.10m", unidad: "UNI", precioUY: 28283.60, aportesSociales: 0 },
  { codigo: "7.3.22", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "VENTANA CORREDIZA ALUMINIO SERIE GALA 1.40x1.10m", unidad: "UNI", precioUY: 22308.20, aportesSociales: 0 },
  { codigo: "7.3.23", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "VENTANA CORREDIZA CON CORTINA LAMA TÉRMICA 1.40x1.10m", unidad: "UNI", precioUY: 36848.36, aportesSociales: 0 },
  { codigo: "7.3.24", capitulo: "Subcontratos - Carpinterías", subcapitulo: "Aluminio", descripcion: "AMURE DE ABERTURAS DE ALUMINIO", unidad: "M2", precioUY: 2535.33, aportesSociales: 993.77 },

  // SUBCONTRATOS - VIDRIOS
  { codigo: "7.4.1", capitulo: "Subcontratos - Vidrios", descripcion: "VIDRIO INCOLORO DE 4mm", unidad: "M2", precioUY: 2284.20, aportesSociales: 0 },
  { codigo: "7.4.2", capitulo: "Subcontratos - Vidrios", descripcion: "VIDRIO INCOLORO DE 5mm", unidad: "M2", precioUY: 2721.60, aportesSociales: 0 },
  { codigo: "7.4.3", capitulo: "Subcontratos - Vidrios", descripcion: "VIDRIO ESMERILADO INCOLORO DE 4mm", unidad: "M2", precioUY: 2430.00, aportesSociales: 0 },
  { codigo: "7.4.4", capitulo: "Subcontratos - Vidrios", descripcion: "VIDRIO TEMPLADO DE 6mm", unidad: "M2", precioUY: 4228.20, aportesSociales: 0 },
  { codigo: "7.4.5", capitulo: "Subcontratos - Vidrios", descripcion: "VIDRIO TEMPLADO DE 8mm", unidad: "M2", precioUY: 5443.20, aportesSociales: 0 },
  { codigo: "7.4.7", capitulo: "Subcontratos - Vidrios", descripcion: "ESPEJO DE 3mm CON COLOCACIÓN", unidad: "M2", precioUY: 3645.00, aportesSociales: 0 },
  { codigo: "7.4.8", capitulo: "Subcontratos - Vidrios", descripcion: "ESPEJO DE 4mm SIN COLOCACIÓN", unidad: "M2", precioUY: 4617.00, aportesSociales: 0 },

  // SUBCONTRATOS - CORTINAS DE ENROLLAR
  { codigo: "7.5.1", capitulo: "Subcontratos - Cortinas de Enrollar", descripcion: "CORTINA DE ENROLLAR DE PVC COMPLETA", unidad: "M2", precioUY: 15120.00, aportesSociales: 0 },
  { codigo: "7.5.2", capitulo: "Subcontratos - Cortinas de Enrollar", descripcion: "CORTINA DE ENROLLAR DE ALUMINIO CON RELLENO POLIURETÁNICO", unidad: "M2", precioUY: 29160.00, aportesSociales: 0 },

  // SUBCONTRATOS - YESO
  { codigo: "7.6.1", capitulo: "Subcontratos - Yeso", descripcion: "EMPLACADO DE YESO PERFIL OMEGA + PLACA", unidad: "M2", precioUY: 939.60, aportesSociales: 0 },
  { codigo: "7.6.2", capitulo: "Subcontratos - Yeso", descripcion: "MURO DE YESO DE 10cm CON AISLACIÓN ACÚSTICA", unidad: "M2", precioUY: 1728.00, aportesSociales: 0 },
  { codigo: "7.6.3", capitulo: "Subcontratos - Yeso", descripcion: "CIELORRASO DE PANEL DE YESO", unidad: "M2", precioUY: 1242.00, aportesSociales: 0 },
  { codigo: "7.6.4", capitulo: "Subcontratos - Yeso", descripcion: "LANA DE ROCA AISLANTE ACÚSTICO e=5mm", unidad: "M2", precioUY: 923.40, aportesSociales: 0 },

  // SISTEMAS NO TRADICIONALES - STEEL FRAMING
  { codigo: "8.1.1", capitulo: "Sistemas No Tradicionales", subcapitulo: "Steel Framing", descripcion: "TECHO DE STEEL FRAMING", unidad: "M2", precioUY: 4544.10, aportesSociales: 0 },
  { codigo: "8.1.2", capitulo: "Sistemas No Tradicionales", subcapitulo: "Steel Framing", descripcion: "PARED DE STEEL FRAMING", unidad: "M2", precioUY: 5613.30, aportesSociales: 0 },

  // SISTEMAS NO TRADICIONALES - PANELES TÉRMICOS
  { codigo: "8.2.1", capitulo: "Sistemas No Tradicionales", subcapitulo: "Paneles Térmicos", descripcion: "ISOPANEL", unidad: "M2", precioUY: 2503.53, aportesSociales: 0 },
  { codigo: "8.2.2", capitulo: "Sistemas No Tradicionales", subcapitulo: "Paneles Térmicos", descripcion: "ISODECK", unidad: "M2", precioUY: 2253.87, aportesSociales: 0 },
  { codigo: "8.2.3", capitulo: "Sistemas No Tradicionales", subcapitulo: "Paneles Térmicos", descripcion: "MONTAJE DE PANELES DE POLIURETANO EXPANDIDO", unidad: "M2", precioUY: 1336.50, aportesSociales: 0 },
];
