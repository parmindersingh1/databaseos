/**
 * Generates JSON sources from database in `build/database.sqlite`.
 */

const { renameSync } = require( 'fs' )
const { groupBy } = require( 'lodash' )
const snakeCaseKeys = require( 'snakecase-keys' )

const colors = require( './string-colors' )
const { createDir, removeDirAsync, writeJSON } = require( './utils' )
const { knex, Compositions, Lines, LineTypes, TranslationSources } = require( '..' )

const OUTPUT_DIR = './data1'
const TMP_DIR = './data.tmp'

/**
 * Retrieves data from a table, ordered by its id.
 * @param {String} tableName
 */
const getTable = async tableName => knex( tableName ).select().orderBy( 'id' )

/**
 * Saves data as JSON, with messages, into the output directory.
 * @param {String} filename The filename to save the JSON as.
 * @param {Object} data The JSON to save.
 * @param {Boolean} [output] Whether to show console output.
 */
const saveData = async ( filename, data, output = true ) => {
  const path = `${TMP_DIR}/${filename}.json`
  await writeJSON( path, data )
  if ( output ) { console.log( `Saved ${path}`.success ) }
}



/**
 * Combines the lines and shabads into a nested structure.
 * ! Speed up by mutating.
 */
const processLines = async () => {



  // await Lines.query().join('line_types').first()
  // .then( ( line  ) => console.log(JSON.stringify(line)) )

  // return Compositions
  //   .query()
  //   .eager( 'shabads(orderById).[writer, section, subsection]', {
  //     orderById: builder => builder.orderBy( 'order_id', 'asc' ),
  //   } )
  //   .eagerAlgorithm( Compositions.WhereInEagerAlgorithm ) //* Ordering not preserved without this
  //   // Group shabads by composition, retrieving the lines for each shabad
  //   .then( compositions => compositions.filter(com => com.nameEnglish  === 'Sri Guru Granth Sahib Ji').map(async ({shabads}) => 
  //   {
  //     return await shabads.map(async shabad =>  (
  //               (await shabad
  //                               .$relatedQuery( 'lines' )
  //                               .orderBy( 'order_id' )
  //                               .eager( '[type, translations.translationSource.language, content.source]' ))).then((res) => console.log("res00")))
  //    }

  return Compositions.query()
  .eager('shabads(orderById).[writer, section, subsection]', {
    orderById: builder => builder.orderBy('order_id', 'asc'),
  })
  .eagerAlgorithm(Compositions.WhereInEagerAlgorithm)
  .then(compositions => {
    const filteredCompositions = compositions.filter(com => com.nameEnglish === 'Sri Guru Granth Sahib Ji');
    return Promise.all(filteredCompositions.map(async composition => {
      const shabadPromises = composition.shabads.map(async shabad => {
        const lines = await shabad
          .$relatedQuery('lines')
          .orderBy('order_id')
          .eager('[type, translations.translationSource.language, content.source]')

        return lines.map( ( {
          orderId,
          firstLetters,
          vishraamFirstLetters,
          typeId,
          shabadId,
          translations,
          type,
          transliterations,
          gurmukhi,
          content,
          ...line
        } ) => ( {
          ...snakeCaseKeys( { ...line, type: ( type && type.nameEnglish ) } ),
          gurmukhi: content.reduce( ( content, { gurmukhi, source } ) => ( {
            ...content,
            [ source.nameEnglish ]: gurmukhi,
          } ), {} ),
          // Generate JSON for transliterations for line organissed by language: data
          translations: translations.reduce( ( acc, {
            translationSourceId,
            lineId,
            translationSource: {
              language: { nameEnglish: languageName },
              nameEnglish: translationSourceName,
            },
            ...translation
          } ) => ( {
            ...acc,
            // Group translations by languages
            [ languageName ]: {
              ...acc[ languageName ],
              // And then the actual name of the translation source of the translation
              [ translationSourceName ]: snakeCaseKeys( {
                ...translation,
                // Must deserialise JSON field from DB
                additionalInformation: JSON.parse( translation.additionalInformation ),
              } ),
            },
          } ), Promise.resolve( {} ) ),
        } ) )

        // Process lines or save to file here
        console.log("lines"); // Check if lines are correctly retrieved
      });

      return Promise.all(shabadPromises);
    }));
  })
 .then((lines) => {
    const  pages = lines.flat().flat().reduce((acc, item, index) => {
      if (index === 0) {
        // console.log("URDU11",JSON.stringify(item));
      }

      const { source_page, ...rest } = item;
      
      if (!acc[source_page]) {
        acc[source_page] = [];
      }
      
      acc[source_page].push(rest);
      
      return acc;
    }, {});
    console.log("All lines processed 666.", JSON.stringify(pages));
  })
  .catch(error => {
    console.error("Error occurred:", error);
  });


                
          // .map( ( {
          //   orderId,
          //   firstLetters,
          //   vishraamFirstLetters,
          //   typeId,
          //   shabadId,
          //   translations,
          //   type,
          //   transliterations,
          //   gurmukhi,
          //   content,
          //   ...line
          //   } ) => ( {
          //     ...snakeCaseKeys( { ...line, type: ( type && type.nameEnglish ) } ),
          //     gurmukhi: content.reduce( ( content, { gurmukhi, source } ) => ( {
          //       ...content,
          //       [ source.nameEnglish ]: gurmukhi,
          //     } ), {} ),
          //     // Generate JSON for transliterations for line organissed by language: data
          //     translations: translations.reduce( ( acc, {
          //       translationSourceId,
          //       lineId,
          //       translationSource: {
          //         language: { nameEnglish: languageName },
          //         nameEnglish: translationSourceName,
          //       },
          //       ...translation
          //     } ) => ( {
          //       ...acc,
          //       // Group translations by languages
          //       [ languageName ]: {
          //         ...acc[ languageName ],
          //         // And then the actual name of the translation source of the translation
          //         [ translationSourceName ]: snakeCaseKeys( {
          //           ...translation,
          //           // Must deserialise JSON field from DB
          //           additionalInformation: JSON.parse( translation.additionalInformation ),
          //         } ),
          //       },
          //     } ), Promise.resolve( {} ) ),
          //   } ) ),
      // ))
    // .then((res) => console.log("res", JSON.stringify(res))).catch(err => console.log("err", err)) 
 
    // Group by pages (determined by page of first line in a shabad)
    // .then( compositions => Object
    //   .entries( compositions )
    //   .reduce( ( acc, [ compositionName, shabads ] ) => ( {
    //     ...acc,
    //     [ compositionName ]: groupBy( shabads, ( { lines: [ first ] } ) => first.source_page ),
    //   } ), {} ) )
    // // Write to disk, by composition/page
    // .then( compositions => Object.entries( compositions ).forEach( ( [ composition, pages ] ) => {
    //   console.log( `Compiling shabads for ${composition}` )

    //   // Get the last page from the objects, to pad strings
    //   const [ lastPage ] = Object.keys( pages ).slice( -1 )

    //   // Save each page to the composition directory
    //   createDir( `${TMP_DIR}/${composition}` )
    //   Object.entries( pages ).forEach( ( [ page, shabads ] ) => saveData( `${composition}/${page.padStart( lastPage.length, '0' )}`, shabads, false ) )
    // } ) )



  // return Compositions
  //   .query()
  //   .eager( 'shabads(orderById).[writer, section, subsection]', {
  //     orderById: builder => builder.orderBy( 'order_id', 'asc' ),
  //   } )
  //   .eagerAlgorithm( Compositions.WhereInEagerAlgorithm ) //* Ordering not preserved without this
  //   // Group shabads by composition, retrieving the lines for each shabad
  //   .then( compositions => compositions.reduce( async ( acc, { shabads, nameEnglish } ) => ( {
  //     ...( await acc ),
  //     [ nameEnglish ]: await Promise.all( shabads.map( async shabad => ( { //! Do not destructure
  //     // Generate JSON with desired keys for Shabad
  //       // ...snakeCaseKeys( {
  //       //   id: shabad.id,
  //       //   sttmId: shabad.sttmId,
  //       //   writer: shabad.writer.nameEnglish,
  //       //   section: shabad.section.nameEnglish,
  //       //   subsection: ( shabad.subsection && shabad.subsection.nameEnglish ) || null, // Nullable
  //       // } ),
  //       // Generate JSON for lines for that shabad with desired keys
  //       lines: ( await shabad
  //         .$relatedQuery( 'lines' )
  //         .orderBy( 'order_id' )
  //         .eager( '[type, translations.translationSource.language, content.source]' )
  //       ).map( ( {
  //         orderId,
  //         firstLetters,
  //         vishraamFirstLetters,
  //         typeId,
  //         shabadId,
  //         translations,
  //         type,
  //         transliterations,
  //         gurmukhi,
  //         content,
  //         ...line
  //       } ) => ( {
  //         ...snakeCaseKeys( { ...line, type: ( type && type.nameEnglish ) } ),
  //         gurmukhi: content.reduce( ( content, { gurmukhi, source } ) => ( {
  //           ...content,
  //           [ source.nameEnglish ]: gurmukhi,
  //         } ), {} ),
  //         // Generate JSON for transliterations for line organissed by language: data
  //         translations: translations.reduce( ( acc, {
  //           translationSourceId,
  //           lineId,
  //           translationSource: {
  //             language: { nameEnglish: languageName },
  //             nameEnglish: translationSourceName,
  //           },
  //           ...translation
  //         } ) => ( {
  //           ...acc,
  //           // Group translations by languages
  //           [ languageName ]: {
  //             ...acc[ languageName ],
  //             // And then the actual name of the translation source of the translation
  //             [ translationSourceName ]: snakeCaseKeys( {
  //               ...translation,
  //               // Must deserialise JSON field from DB
  //               additionalInformation: JSON.parse( translation.additionalInformation ),
  //             } ),
  //           },
  //         } ), Promise.resolve( {} ) ),
  //       } ) ),
  //     } ) ) ),
  //   } ), {} ) )
  //   // Group by pages (determined by page of first line in a shabad)
  //   .then( compositions => Object
  //     .entries( compositions )
  //     .reduce( ( acc, [ compositionName, shabads ] ) => ( {
  //       ...acc,
  //       [ compositionName ]: groupBy( shabads, ( { lines: [ first ] } ) => first.source_page ),
  //     } ), {} ) )
  //   // Write to disk, by composition/page
  //   .then( compositions => Object.entries( compositions ).forEach( ( [ composition, pages ] ) => {
  //     console.log( `Compiling shabads for ${composition}` )

  //     // Get the last page from the objects, to pad strings
  //     const [ lastPage ] = Object.keys( pages ).slice( -1 )

  //     // Save each page to the composition directory
  //     createDir( `${TMP_DIR}/${composition}` )
  //     Object.entries( pages ).forEach( ( [ page, shabads ] ) => saveData( `${composition}/${page.padStart( lastPage.length, '0' )}`, shabads, false ) )
  //   } ) )
}



/**
 * Runs all the generation functions.
 */
const main = async () => {
  console.log( 'Generating JSON sources'.header )

  // Work in temp folder
  await removeDirAsync( TMP_DIR )
  createDir( TMP_DIR )

  // Run extraction
  // await processSimpleTables()
  // await processBanis()
  // await processCompositions()
  // await processTranslationSources()
  await processLines()

  // Move tmp folder to output folder
  console.log( `\nMoving ${TMP_DIR} to ${OUTPUT_DIR}`.subheader )
  await removeDirAsync( OUTPUT_DIR )
  renameSync( TMP_DIR, OUTPUT_DIR )

  console.log( '\nSuccessfully generated JSON sources'.success.bold )
}

main()
  .then( () => process.exit( 0 ) )
  .catch( async e => {
    console.error( e.message.error )
    console.error( e )
    console.error( '\nFailed to generate JSON sources'.error.bold )
    process.exit( 1 )
  } )
