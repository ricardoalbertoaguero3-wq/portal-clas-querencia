# Sustento legal del aplicativo "Gestión de Inventario"

**CLAS Agregado La Querencia — Centro de Salud CLAS Querencia (Huaral, Lima)**

> El aplicativo genera este mismo informe con los datos institucionales: **Marco normativo → Imprimir informe de sustento legal**
> (estructura del Anexo N° 01). El texto fuente está en `js/normativa.js`.

## 1. Norma que implementa

**Directiva N° 0006-2021-EF/54.01**, "Directiva para la gestión de bienes muebles patrimoniales en el marco del Sistema
Nacional de Abastecimiento". Fue aprobada por la R.D. N° 0015-2021-EF/54.01 de la Dirección General de Abastecimiento del
MEF y publicada en El Peruano el 26/12/2021.

Desde el D.Leg. N° 1439, el ente rector de los **bienes muebles** es la DGA-MEF, no la SBN. La SBN conserva la rectoría
sobre los bienes inmuebles.

## 2. Naturaleza del aplicativo

Es un **registro operativo y una herramienta de control interno** del establecimiento. **No sustituye** al Módulo de
Patrimonio del SIGA MEF, que es el registro oficial (arts. 21.1 y 23; o el SINABIP, según la 3ª Disposición
Complementaria Transitoria). Ese registro lo lleva la OCP de la Unidad Ejecutora en un plazo de 10 días hábiles. El
aplicativo prepara la información y los formatos que la OCP necesita para registrar.

## 3. Habilitación normativa

| Fundamento | Contenido |
|---|---|
| Directiva, art. 19 | La identificación del bien tiene por finalidad "facilitar su asignación, control, trazabilidad y custodia". |
| Directiva, art. 22.2 | La OCP mantiene actualizada la información del registro. |
| Directiva, art. 6 a) y c) | La OGA supervisa la asignación en uso y verifica el cumplimiento de la Directiva. |
| Directiva, arts. 35.4 y 94 | Verificación y supervisión "física o digital" mediante herramientas tecnológicas. |
| Ley N° 28716 | Control interno: resguardo de los bienes del Estado. |
| D.Leg. N° 1412 | Gobierno digital: uso de herramientas digitales en la gestión. |
| Ley N° 29733 | Protección de los datos personales de los usuarios (DNI, correo). |

## 4. Correspondencia aplicativo ↔ Directiva

| Módulo | Artículos | Formato |
|---|---|---|
| Registro de bienes | 5, 19–22 | Apéndice A |
| Alta (causales del art. 16.1; compra con PECOSA/NEA, art. 21.3) | 15–18, 21 | Anexos N° 01 y 02 |
| Etiquetas | 20, 35.3.d | — |
| Anulación de registro / modificación de valor | 24–25 | Anexo N° 01 |
| Asignación en uso y devolución | 26–30 | Anexo N° 03 |
| Salida, reingreso y desplazamiento interno | 28.3–28.4, 30.c, 87 | Anexo N° 04 |
| Inventario anual | 31–37 | Anexos N° 05, 06, 07 y 09 |
| Saneamiento de sobrantes y faltantes | 38–46 | Anexos N° 01 y 02 |
| Baja (11 causales del art. 48.1) | 47–51 | Anexo N° 01 y Apéndice A |
| Afectación en uso y su extinción | 53–59 | Anexo N° 02 |
| Disposición (transferencia, donación, subasta, permuta; eliminación) | 52, 60–82; 8ª DCF | Anexos N° 01 y 02 |
| Mantenimiento y aseguramiento | 83–91; 6ª y 7ª DCF | Anexo N° 04 |
| Supervisión | 6, 94–95 | Anexo N° 07 |

**Plazos que controla el aplicativo:**
- Asignar en uso dentro de los 20 días hábiles de incorporado el bien (art. 26.2).
- Registrar dentro de los 10 días hábiles de culminado el trámite (art. 23).
- Ejecutar la disposición dentro de los 5 meses de emitida la resolución de baja (art. 50.1).
- Afectación en uso por un plazo máximo de 1 año, con aviso 15 días hábiles antes del vencimiento (art. 56).
- Inventario con cierre al 31/12 y presentación hasta el 15/03 o el 31/03 (arts. 31 y 36).
- Posesión mínima de 1 año para sanear sobrantes (art. 39).
- Denuncia y comunicación a la OCP en 24 horas ante sustracción o daño (art. 30.d).

**Formatos que no genera:** el Anexo N° 08 (Ficha técnica de vehículo) y el Anexo N° 10 (Bases de subasta).

## 5. Condiciones de validez

1. Los formatos surten efecto **solo con las firmas** de los responsables que indica cada anexo.
2. Los actos que requieren resolución se registran **después** de emitida la resolución, cuyo número es obligatorio.
   Esto aplica al alta por las causales del art. 16, la baja, la disposición, la afectación en uso, la eliminación de
   registro y la modificación de valor. Antes de la resolución, el aplicativo genera el **borrador del Informe Técnico**.
3. El uso del aplicativo debe aprobarse mediante un documento de la Gerencia del CLAS, que además designe al responsable
   de Control Patrimonial y a los usuarios.
4. La información se remite a la OCP de la Unidad Ejecutora para su registro en el SIGA MEF.

## 6. Puntos por definir con la Unidad Ejecutora (ambigüedades)

1. **Ámbito (art. 3):** el CLAS es una asociación civil privada que cogestiona un establecimiento público (Ley N° 29124);
   no es una Entidad del SNA. Debe definirse por escrito qué bienes son de la UE y cuáles del CLAS. En el aplicativo,
   este dato se registra en el campo *Titularidad*.
2. **OGA y OCP:** para los bienes del Estado, la OGA y la OCP son las de la UE. Los bienes propios del CLAS no están
   regulados expresamente por la Directiva.
3. **Plazo de presentación del inventario:** el 15/03 (si el establecimiento se trata como Organización de la Entidad) o el
   31/03 (Entidad).
4. **Vigencia:** verificar si la DGA aprobó modificatorias posteriores al 26/12/2021.
