# Ave in Spanish

Status: **awaiting review by a Spanish-speaking priest.** Added 2026-10-03.

The Spanish interface lives in `site/i18n.js` (English is the source text in
`site/app.js` and `site/index.html`). `scripts/test/i18n.test.mjs` fails if any
string passed to `t()` or any static text in `index.html` has no Spanish entry,
or if any Spanish prayer is empty.

## What is in Spanish

- The interface, the rosary (prayers, the twenty mysteries, rubrics), the Order
  of Mass, season notes, book notes, Sunday notes, vestment colours, and the
  regular liturgical day titles (by pattern; great feasts by table; other
  saints' days stay English).
- Mass tab: each reading's Spanish label and its citation with Spanish book
  names (Lectionary numbers kept), a link to the USCCB Spanish readings for the
  day (`https://bible.usccb.org/es/bible/lecturas/MMDDYY.cfm`), and a toggle to
  show the English text.

## What stays English for now

- Bible text. No Catholic Spanish Bible could be verified as public domain
  and usable, so Ave prints no Spanish Bible text.
- Booklets and the print view pages (the controls and notes around them are
  Spanish, with a note that the booklet text is in English).
- Guides. There are no Spanish guides; in Spanish the Plain, Kids and Family
  editions are unavailable. Spanish guides, when written, follow the same rules
  as all guides (AI-assisted, shown only after a priest approves).
- Saints' day titles not in the table, the review page, and the API.

## Prayer texts used (for review)

These are the traditional texts as commonly prayed in Spanish-speaking parishes
in the United States, written from that common tradition, not invented. Please
confirm each one, or give the wording your parish uses. If a text is changed,
edit `es.prayers` in `site/i18n.js` and this file together.

### Señal de la Cruz (`sign`)

> En el nombre del Padre, y del Hijo, y del Espíritu Santo. Amén.

The short form, matching the English app. Many Hispanic families begin the rosary with the longer *persignarse*: “Por la señal de la Santa Cruz, de nuestros enemigos líbranos, Señor, Dios nuestro. En el nombre del Padre…”. Reviewer: should Ave use that form?

- [ ] Reviewed by: ______

### Credo de los Apóstoles (`creed`)

> Creo en Dios, Padre todopoderoso, Creador del cielo y de la tierra. Creo en Jesucristo, su único Hijo, Nuestro Señor, que fue concebido por obra y gracia del Espíritu Santo, nació de santa María Virgen, padeció bajo el poder de Poncio Pilato, fue crucificado, muerto y sepultado, descendió a los infiernos, al tercer día resucitó de entre los muertos, subió a los cielos y está sentado a la derecha de Dios, Padre todopoderoso. Desde allí ha de venir a juzgar a vivos y muertos. Creo en el Espíritu Santo, la santa Iglesia católica, la comunión de los santos, el perdón de los pecados, la resurrección de la carne y la vida eterna. Amén.

Text of the Apostles' Creed as in the Spanish Misal Romano used in Mexico and the United States.

- [ ] Reviewed by: ______

### Padre Nuestro (`our`)

> Padre nuestro, que estás en el cielo, santificado sea tu Nombre; venga a nosotros tu reino; hágase tu voluntad en la tierra como en el cielo. Danos hoy nuestro pan de cada día; perdona nuestras ofensas, como también nosotros perdonamos a los que nos ofenden; no nos dejes caer en la tentación, y líbranos del mal. Amén.

Reviewer: confirm “no nos dejes caer en la tentación” (US/Mexico) rather than the newer Spain wording “no nos dejes caer en tentación”.

- [ ] Reviewed by: ______

### Ave María (`hail`)

> Dios te salve, María, llena eres de gracia, el Señor es contigo. Bendita tú eres entre todas las mujeres, y bendito es el fruto de tu vientre, Jesús. Santa María, Madre de Dios, ruega por nosotros, pecadores, ahora y en la hora de nuestra muerte. Amén.

Traditional rosary form (“Dios te salve, María”). Some communities say “el fruto de tu vientre” without “es”; confirm.

- [ ] Reviewed by: ______

### Gloria (`glory`)

> Gloria al Padre, y al Hijo, y al Espíritu Santo. Como era en el principio, ahora y siempre, por los siglos de los siglos. Amén.

- [ ] Reviewed by: ______

### Oración de Fátima (`fatima`)

> Oh Jesús mío, perdona nuestros pecados, líbranos del fuego del infierno, lleva al cielo a todas las almas, especialmente a las más necesitadas de tu misericordia.

Several close variants circulate (e.g. “y socorre especialmente a las más necesitadas…”). Confirm the wording.

- [ ] Reviewed by: ______

### Salve (`queen`)

> Dios te salve, Reina y Madre de misericordia, vida, dulzura y esperanza nuestra; Dios te salve. A ti llamamos los desterrados hijos de Eva; a ti suspiramos, gimiendo y llorando, en este valle de lágrimas. Ea, pues, Señora, abogada nuestra, vuelve a nosotros esos tus ojos misericordiosos; y después de este destierro muéstranos a Jesús, fruto bendito de tu vientre. ¡Oh clementísima, oh piadosa, oh dulce Virgen María!
>
> V. Ruega por nosotros, santa Madre de Dios.
>
> R. Para que seamos dignos de alcanzar las promesas de Nuestro Señor Jesucristo. Amén.

V. and R. are shown after the prayer, as in English.

- [ ] Reviewed by: ______

### Oración final (`closing`)

> Oremos. Oh Dios, cuyo Hijo unigénito, con su vida, muerte y resurrección, nos alcanzó el premio de la vida eterna; concédenos, te rogamos, que meditando estos misterios del Santísimo Rosario de la Bienaventurada Virgen María, imitemos lo que contienen y alcancemos lo que prometen. Por el mismo Cristo nuestro Señor. Amén.

**Most in need of review.** Several Spanish versions of this collect circulate in rosary booklets; this is one common form. Please give the approved wording if it differs.

- [ ] Reviewed by: ______

## The mysteries (for review)

Name · Scripture (Spanish book names) · fruit · one line. The one-line descriptions
are Ave's own plain sentences, translated from the English app, not quotations.

### Misterios Gozosos (Lunes y sábados)

1. **La Anunciación** · Lucas 1, 26–38 · fruto: la humildad. El ángel Gabriel trae el mensaje de Dios, y María responde que sí.
2. **La Visitación** · Lucas 1, 39–56 · fruto: el amor al prójimo. María va de prisa a ayudar a su prima Isabel, y el niño en el seno de Isabel salta de alegría.
3. **El Nacimiento de Jesús** · Lucas 2, 1–20 · fruto: la pobreza de espíritu. Jesús nace en Belén y es recostado en un pesebre.
4. **La Presentación en el Templo** · Lucas 2, 22–38 · fruto: la obediencia. María y José llevan al niño al Templo, y el anciano Simeón lo reconoce.
5. **El Niño perdido y hallado en el Templo** · Lucas 2, 41–52 · fruto: la alegría de encontrar a Jesús. Después de tres días de búsqueda, encuentran a Jesús entre los maestros.

### Misterios Dolorosos (Martes y viernes)

1. **La Oración en el Huerto** · Mateo 26, 36–46 · fruto: el dolor de los pecados. Jesús ora en Getsemaní: que no se haga mi voluntad, sino la tuya.
2. **La Flagelación** · Juan 19, 1 · fruto: la pureza. Jesús es atado y azotado, y lo soporta en silencio.
3. **La Coronación de espinas** · Mateo 27, 27–31 · fruto: la valentía. Los soldados se burlan de Jesús como rey y le ponen una corona de espinas.
4. **Jesús con la Cruz a cuestas** · Lucas 23, 26–32 · fruto: la paciencia. Jesús carga la cruz hasta el Calvario, y Simón le ayuda.
5. **La Crucifixión** · Lucas 23, 33–46 · fruto: la perseverancia. Jesús perdona, nos da a su madre y entrega su espíritu.

### Misterios Gloriosos (Miércoles y domingos)

1. **La Resurrección** · Mateo 28, 1–10 · fruto: la fe. El sepulcro está vacío. Cristo ha resucitado, como lo había dicho.
2. **La Ascensión** · Hechos 1, 6–11 · fruto: la esperanza. Jesús bendice a sus amigos y sube al Padre.
3. **La Venida del Espíritu Santo** · Hechos 2, 1–13 · fruto: el amor a Dios. Lenguas de fuego se posan sobre los apóstoles, y hablan con valentía.
4. **La Asunción de María** · Apocalipsis 11, 19–12, 1 · fruto: la gracia de una buena muerte. María es llevada en cuerpo y alma al cielo.
5. **La Coronación de María** · Apocalipsis 12, 1 · fruto: la confianza en la intercesión de María. María es coronada Reina del cielo y de la tierra.

### Misterios Luminosos (Jueves)

1. **El Bautismo en el Jordán** · Mateo 3, 13–17 · fruto: la apertura al Espíritu Santo. Los cielos se abren, y el Padre dice: este es mi Hijo amado.
2. **Las Bodas de Caná** · Juan 2, 1–11 · fruto: ir a Jesús por María. María dice: hagan lo que él les diga, y el agua se convierte en vino.
3. **El Anuncio del Reino** · Marcos 1, 14–15 · fruto: la conversión. Jesús llama a todos a volver a Dios y a creer.
4. **La Transfiguración** · Lucas 9, 28–36 · fruto: el deseo de santidad. En el monte, Jesús resplandece con la gloria de Dios.
5. **La Institución de la Eucaristía** · Lucas 22, 14–20 · fruto: la adoración. En la Última Cena, Jesús nos da su Cuerpo y su Sangre.

## Wording choices to confirm

- Formal *usted* throughout the interface.
- “Folletos” for booklets and “misalito” for the parish missalette.
- Postures: De pie, Sentados, De rodillas, Pase al frente.
- “Ordinario de la Misa”, “Aclamación antes del Evangelio”, “Oración universal”, “Rito de la paz”.
- Sunday notes are paraphrased; they do not quote a Spanish Lectionary.
