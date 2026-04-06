export interface Apunte {
  id: string;
  titulo: string;
  autor: string;
  universidad: string;
  materia: string;
  precio: number;
  moneda: string;
  puntaje: number;
  totalReseñas: number;
  paginas: number;
  pdfUrl: string;
}

export interface Usuario {
  nombre: string;
  email: string;
  avatar: string;
  logueado: boolean;
}

export const apuntesMock: Apunte[] = [
  {
    id: "001",
    titulo: "Resumen Derecho Constitucional — Unidad 3",
    autor: "María González",
    universidad: "UBA",
    materia: "Derecho Constitucional",
    precio: 850,
    moneda: "ARS",
    puntaje: 4.7,
    totalReseñas: 38,
    paginas: 24,
    pdfUrl: "/sample.pdf",
  },
  {
    id: "002",
    titulo: "Álgebra Lineal — Espacios Vectoriales",
    autor: "Lucas Fernández",
    universidad: "UTN",
    materia: "Álgebra II",
    precio: 600,
    moneda: "ARS",
    puntaje: 4.3,
    totalReseñas: 21,
    paginas: 18,
    pdfUrl: "/sample.pdf",
  },
  {
    id: "003",
    titulo: "Introducción a la Economía — Micro y Macro",
    autor: "Camila Ruiz",
    universidad: "UNC",
    materia: "Economía I",
    precio: 750,
    moneda: "ARS",
    puntaje: 4.9,
    totalReseñas: 52,
    paginas: 32,
    pdfUrl: "/sample.pdf",
  },
];

export const usuarioMock: Usuario = {
  nombre: "Juan Pérez",
  email: "juan.perez@estudiante.uba.ar",
  avatar: "JP",
  logueado: false,
};

export function getApunteById(id: string): Apunte | undefined {
  return apuntesMock.find((a) => a.id === id);
}
