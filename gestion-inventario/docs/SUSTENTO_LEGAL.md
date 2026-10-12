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

## 1-A. Norma de la cogestión CLAS

**Reglamento de la Ley N° 29124**, aprobado por el D.S. N° 017-2008-SA y publicado en El Peruano el 01/08/2008. Las
disposiciones sobre bienes son las siguientes:

| Artículo | Contenido | Aplicación en el aplicativo |
|---|---|---|
| 7 | El CLAS es una asociación civil sin fines de lucro con personería jurídica. | Explica el ámbito de la Directiva (ver §6). |
| 36.n, 36.o | La Asamblea General vigila el patrimonio estatal entregado a la CLAS y la inclusión de los bienes adquiridos en cada ejercicio. | Informe semestral de situación patrimonial. |
| 43.f | El Consejo Directivo vela por el buen uso, la conservación y la custodia de los bienes otorgados en administración. | Informe mensual; rol de consulta. |
| 49.c, 49.e, 49.h | El Gerente mantiene la existencia y la conservación de los bienes; informa mensualmente al Consejo Directivo y semestralmente a la Asamblea General; presenta un diagnóstico dentro de los 60 días de asumir el cargo. | Informe de situación patrimonial (mensual, semestral o diagnóstico). |
| **63.d, 68.d** | **Los bienes adquiridos o donados durante el ejercicio se transfieren a título gratuito al Gobierno Regional y se incorporan al patrimonio del Estado.** | Acto **Transferencia al Gobierno Regional** (acta, Anexo N° 02); titularidad; alerta de pendientes. |
| 69 | El CLAS lleva su contabilidad como persona jurídica (Plan Contable General). | Conciliación por titularidad. |
| 72.l | El convenio de cogestión regula la disposición de los bienes y recursos. | Revisar el convenio vigente. |
| 79.a, 79.f | El Gobierno Regional dota de mobiliario y equipos, y realiza el inventario de los establecimientos. | El inventario del CLAS es el insumo del inventario regional. |
| 81.a, 81.d | El CLAS administra los bienes asignados y ejecuta el plan anual de mantenimiento. | Módulo de mantenimiento. |
| 84 | Si se resuelve el convenio, el Gobierno Regional administra transitoriamente los bienes. | Registro y respaldo para la entrega. |
| 103.d, 104 | Supervisión integral mínima semestral; rendición de cuentas mensual a la DIRESA y semestral a la comunidad. | Proceso de supervisión; informe de rendición de cuentas. |
| 105 | La vigilancia ciudadana puede denunciar el uso inadecuado de equipos. | Ficha de asignación y kardex por usuario. |
| 107–108 | Control de la DIRESA y del Gobierno Local; la Ley N° 27785 se aplica a los bienes del Estado que administra el CLAS. | Bitácora y sustento documental obligatorio. |

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
| D.S. N° 017-2008-SA, arts. 43.f, 49.e y 81.a | El Consejo Directivo y el Gerente custodian y administran los bienes otorgados al CLAS. |
| D.S. N° 017-2008-SA, art. 108; Ley N° 27785 | Control gubernamental sobre los bienes del Estado que el CLAS administra. |
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
| Supervisión | 6, 94–95; Reglamento 103.d | Anexo N° 07 |
| Transferencia al Gobierno Regional | Reglamento 63.d y 68.d; Directiva 16.1.e | Anexo N° 02 + relación valorizada |
| Informe de situación patrimonial | Reglamento 36.n, 43.f, 49.c, 49.h y 104 | Informe propio |

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

## 6. Puntos por definir con la DIRESA / Unidad Ejecutora

1. **Titularidad.** El Reglamento resuelve la mayor parte de esta duda: los bienes adquiridos o donados al CLAS se
   transfieren al Gobierno Regional y pasan a ser patrimonio del Estado (arts. 63.d y 68.d). Por eso la Directiva se
   aplica a todos los bienes, con el CLAS como administrador. Queda por precisar un punto: el art. 36.o menciona la
   inclusión de los bienes "al patrimonio de la CLAS en cada ejercicio". El aplicativo lo interpreta como una
   incorporación transitoria hasta la transferencia; conviene confirmarlo con la OAJ de la DIRESA.
2. **Oportunidad y procedimiento de la transferencia.** El Reglamento no fija un plazo. El aplicativo propone hacerla al
   cierre del ejercicio. Revise el convenio de cogestión (art. 72.l) o la directiva regional. Para el Gobierno Regional,
   el ingreso del bien es un alta por transferencia (Directiva, art. 16.1.e).
3. **OGA y OCP.** Las resoluciones de la Directiva corresponden a la UE o al Gobierno Regional. En el CLAS, la custodia
   está a cargo del Consejo Directivo (art. 43.f) y del Gerente (art. 49.e).
4. **Inventario.** El Reglamento lo encarga al Gobierno Regional (art. 79.f) y la Directiva a la OGA (art. 31). Hay que
   definir si el CLAS conforma su propia Comisión o se integra a la de la UE, y si el plazo es el 15/03 o el 31/03.
5. **Plan de mantenimiento.** El Reglamento pide un plan anual (art. 81.d) y la Directiva uno multianual de al menos
   3 años (art. 86). El plan anual puede entenderse como el tramo de un año del plan multianual.
6. **Vigencia.** Verificar si la Directiva (2021) o el Reglamento (2008) tienen modificatorias posteriores.

## 7. Situación actual del inventario 2025

Los 537 bienes cargados figuran con titularidad "No determinado". Según el art. 63.d, los bienes adquiridos en
ejercicios anteriores ya debieron transferirse al Gobierno Regional. Antes de cambiar su titularidad en el aplicativo,
conviene verificar con la OCP de la UE cuáles están registrados en el SIGA MEF de la UE y cuáles siguen pendientes.
