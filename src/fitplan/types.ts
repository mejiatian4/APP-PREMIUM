type Sexo = 'masculino' | 'femenino';
type Somatotipo = 'ectomorfo' | 'mesomorfo' | 'endomorfo';
type Objetivo = 'perder_grasa' | 'ganar_musculo' | 'definicion' | 'salud_general' | 'resistencia' | 'fuerza';
type Nivel = 'principiante' | 'intermedio' | 'avanzado';
type Equipo = 'gym_completo' | 'mancuernas' | 'cuerpo';
type HeightUnit = 'cm' | 'ft';
type WeightUnit = 'kg' | 'lb';
export type ImcClass = 'bajo' | 'normal' | 'sobrepeso' | 'obesidad1' | 'obesidad2';

export interface FitPlanState {
  age: number;
  height: number;
  weight: number;
  sexo: Sexo;
  somato: Somatotipo;
  dias: number;
  objetivo: Objetivo;
  nivel: Nivel;
  equipo: Equipo;
  heightUnit: HeightUnit;
  weightUnit: WeightUnit;
}

export interface ImcMetrics {
  imc: number;
  cat: string;
  cls: ImcClass;
  desc: string;
  tdee: number;
  pesoIdeal: number;
  grasaCorp: number;
  pct: number;
  pesoKg: number;
}
