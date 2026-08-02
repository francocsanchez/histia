import { connectToDatabase } from "@/lib/db/mongoose";
import { CodigoObraSocialModel } from "@/models/codigo-obra-social";
import { ObraSocialModel } from "@/models/obra-social";
import { PacienteModel } from "@/models/paciente";
import { UserModel } from "@/models/user";
import { DashboardStatsDto } from "@/types/domain";

export async function getDashboardStats(): Promise<DashboardStatsDto> {
  await connectToDatabase();

  const [
    obrasSocialesActivas,
    codigosActivos,
    pacientesActivos,
    usuariosActivos,
  ] = await Promise.all([
    ObraSocialModel.countDocuments({ activo: true }),
    CodigoObraSocialModel.countDocuments({ activo: true }),
    PacienteModel.countDocuments({ activo: true }),
    UserModel.countDocuments({ activo: true }),
  ]);

  return {
    obrasSocialesActivas,
    codigosActivos,
    pacientesActivos,
    usuariosActivos,
  };
}
