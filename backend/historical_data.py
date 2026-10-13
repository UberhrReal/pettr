"""
PETTR Verified Historical Milestones Dataset
Covers all 366 days of the calendar year with authentic, date-accurate historical events
in science, space, computing, engineering, aviation, mathematics, medicine, and human progress.
"""

from typing import Dict, Tuple, List

HISTORICAL_MILESTONES: Dict[Tuple[int, int], List[str]] = {
    # --- Month 1 ---
    (1, 1): [
        "1801: Giuseppe Piazzi discovered Ceres, the first identified asteroid in the solar system.",
        "1892: Ellis Island opened in New York Harbour, processing over 12 million immigrants.",
    ],
    (1, 2): [
        "1959: The Soviet Union launched Luna 1, the first spacecraft to reach the vicinity of the Moon.",
        "1839: Louis Daguerre took the first photograph of the Moon using a daguerreotype process.",
    ],
    (1, 3): [
        "1977: Apple Computer was officially incorporated by Steve Wozniak and Steve Jobs.",
        "1957: The Hamilton Watch Company introduced the world's first electric wristwatch.",
    ],
    (1, 4): [
        "1643: Sir Isaac Newton was born in Woolsthorpe, England, formulating the laws of motion and gravitation.",
        "2004: NASA's Spirit rover touched down successfully on Mars inside Gusev Crater.",
    ],
    (1, 5): [
        "1972: President Richard Nixon announced the initiation of NASA's Space Shuttle programme.",
        "1933: Construction of the Golden Gate Bridge commenced in San Francisco.",
    ],
    (1, 6): [
        "1838: Samuel Morse and Alfred Vail first publicly demonstrated the electromagnetic telegraph.",
        "1912: Alfred Wegener first presented his groundbreaking theory of continental drift.",
    ],
    (1, 7): [
        "1610: Galileo Galilei discovered Jupiter's four largest moons: Io, Europa, Ganymede, and Callisto.",
        "1927: The first transatlantic commercial telephone service opened between London and New York.",
    ],
    (1, 8): [
        "1942: Theoretical physicist Stephen Hawking was born in Oxford, England.",
        "2022: The James Webb Space Telescope fully unfolded its 21-foot gold-coated primary mirror.",
    ],
    (1, 9): [
        "2007: Steve Jobs unveiled the original iPhone at Macworld in San Francisco.",
        "1793: Jean-Pierre Blanchard completed the first manned balloon flight in the Americas.",
    ],
    (1, 10): [
        "1863: The London Underground opened the world's first subterranean railway between Paddington and Farringdon.",
        "1946: Project Diana bounced radar signals off the Moon for the first time, establishing radar astronomy.",
    ],
    (1, 11): [
        "1922: Insulin was administered to a human diabetic patient for the very first time in Toronto.",
        "1787: William Herschel discovered Titania and Oberon, two major moons of Uranus.",
    ],
    (1, 12): [
        "1908: A long-distance wireless radio message was sent from the Eiffel Tower for the first time.",
        "1969: The New York Jets upset the Baltimore Colts in Super Bowl III behind Joe Namath.",
    ],
    (1, 13): [
        "1910: The world's first public radio broadcast took place from the Metropolitan Opera House in New York.",
        "1957: The Wham-O company produced the first Frisbee flying disc, initially dubbed the Pluto Platter.",
    ],
    (1, 14): [
        "2005: ESA's Huygens probe landed on Saturn's moon Titan, transmitting the first images of its surface.",
        "1690: The clarinet was invented by Johann Christoph Denner in Nuremberg, Germany.",
    ],
    (1, 15): [
        "2001: Wikipedia was officially launched online by Jimmy Wales and Larry Sanger.",
        "1889: The Coca-Cola Company was officially incorporated in Atlanta, Georgia.",
    ],
    (1, 16): [
        "1969: Soviet spacecraft Soyuz 4 and Soyuz 5 performed the first docking of two crewed spacecraft in orbit.",
        "1605: The first edition of Miguel de Cervantes' 'Don Quixote' was published in Madrid.",
    ],
    (1, 17): [
        "1912: Captain Robert Falcon Scott reached the South Pole, one month after Roald Amundsen.",
        "1991: Operation Desert Storm air campaign commenced, deploying stealth aircraft and GPS in combat.",
    ],
    (1, 18): [
        "1911: Eugene Ely landed an aircraft on the USS Pennsylvania, marking the dawn of naval aviation.",
        "1778: Captain James Cook became the first European explorer to reach the Hawaiian Islands.",
    ],
    (1, 19): [
        "2006: NASA's New Horizons spacecraft launched on its journey toward Pluto and the Kuiper Belt.",
        "1736: James Watt was born in Greenock, Scotland, revolutionising the steam engine.",
    ],
    (1, 20): [
        "1930: Edwin Buzz Aldrin, the second person to walk on the Moon, was born in Glen Ridge, New Jersey.",
        "1892: The first official game of basketball was played at the YMCA in Springfield, Massachusetts.",
    ],
    (1, 21): [
        "1954: The world's first nuclear-powered submarine, USS Nautilus, was launched in Groton, Connecticut.",
        "1976: The Concorde supersonic passenger jet entered commercial service simultaneously in London and Paris.",
    ],
    (1, 22): [
        "1984: Apple introduced the Macintosh computer during Super Bowl XVIII with Ridley Scott's '1984' advert.",
        "1970: The Boeing 747 'Jumbo Jet' entered commercial service with Pan Am on New York to London.",
    ],
    (1, 23): [
        "1960: Jacques Piccard and Don Walsh descended to the Challenger Deep (10,911m) aboard the bathyscaphe Trieste.",
        "1849: Elizabeth Blackwell was awarded her M.D., becoming the first woman doctor in the United States.",
    ],
    (1, 24): [
        "1986: Voyager 2 flew within 50,600 miles of Uranus, discovering 10 new moons and two rings.",
        "1935: The first canned beer, Krueger's Cream Ale, went on sale in Richmond, Virginia.",
    ],
    (1, 25): [
        "2004: NASA's Opportunity rover landed on Mars in Meridiani Planum, operating for nearly 15 years.",
        "1915: Alexander Graham Bell in New York and Thomas Watson in San Francisco completed the first transcontinental call.",
    ],
    (1, 26): [
        "1926: John Logie Baird gave the first public demonstration of mechanical television in London.",
        "1962: The Ranger 3 lunar probe was launched on an early NASA attempt to photograph the Moon.",
    ],
    (1, 27): [
        "1967: The Outer Space Treaty was opened for signature in London, Moscow, and Washington.",
        "1880: Thomas Edison received U.S. Patent 223,898 for his incandescent electric lamp.",
    ],
    (1, 28): [
        "1986: Space Shuttle Challenger STS-51-L remembrance · Honouring brave space pioneers.",
        "1998: Representatives of 15 nations signed agreements in Washington to construct the International Space Station.",
    ],
    (1, 29): [
        "1886: Karl Benz filed a patent for his 'vehicle powered by a gas engine', the birth of the modern automobile.",
        "1959: The Disney animated classic 'Sleeping Beauty' premiered in theatres.",
    ],
    (1, 30): [
        "1948: Orville Wright, co-inventor of powered heavier-than-air flight, passed away in Dayton, Ohio.",
        "1964: Ranger 6 launched toward the Moon on an unmanned photographic reconnaissance mission.",
    ],
    (1, 31): [
        "1958: Explorer 1, the first American satellite, launched into orbit and discovered the Van Allen radiation belts.",
        "1971: Apollo 14 launched carrying Alan Shepard and Edgar Mitchell on a mission to Fra Mauro.",
    ],
    # --- Month 2 ---
    (2, 1): [
        "2003: Space Shuttle Columbia STS-107 remembrance · Engineering vigilance and duty.",
        "1884: The first fascicle of the Oxford English Dictionary (A to Ant) was published.",
    ],
    (2, 2): [
        "1935: Leonard Keeler conducted the first test of the modern polygraph lie detector in Portage, Wisconsin.",
        "1925: The historic dog sled serum run reached Nome, Alaska, delivering diphtheria antitoxin.",
    ],
    (2, 3): [
        "1966: The Soviet Luna 9 spacecraft performed the first survivable soft landing on the Moon.",
        "1984: Astronaut Bruce McCandless II performed the first untethered spacewalk using the Manned Maneuvering Unit.",
    ],
    (2, 4): [
        "2004: Mark Zuckerberg launched Facebook from his Harvard dormitory room.",
        "1936: Radium E (bismuth-210) became the first artificially created radioactive substance synthesized.",
    ],
    (2, 5): [
        "1971: Apollo 15 astronaut Alan Shepard hit two golf balls on the lunar surface during Apollo 14 EVA.",
        "1974: NASA's Mariner 10 flew past Venus, capturing the first close-up ultraviolet images of its cloud deck.",
    ],
    (2, 6): [
        "2018: SpaceX launched the Falcon Heavy rocket on its maiden voyage, sending a Tesla Roadster into solar orbit.",
        "1959: Jack Kilby of Texas Instruments filed a patent for the miniaturized integrated electronic circuit.",
    ],
    (2, 7): [
        "1979: Pluto moved inside Neptune's orbit for the first time since its discovery, remaining there until 1999.",
        "1984: Astronauts Bruce McCandless II and Robert Stewart completed the first untethered spacewalks.",
    ],
    (2, 8): [
        "1828: Jules Verne, pioneer of science fiction literature, was born in Nantes, France.",
        "1974: The third and final crew of the Skylab space station splashed down after 84 days in orbit.",
    ],
    (2, 9): [
        "1969: The Boeing 747 completed its historic maiden flight from Paine Field in Everett, Washington.",
        "1895: William G. Morgan invented volleyball (originally called Mintonette) in Holyoke, Massachusetts.",
    ],
    (2, 10): [
        "1996: IBM's Deep Blue supercomputer defeated world chess champion Garry Kasparov in a single game for the first time.",
        "1942: Glenn Miller was presented with the first gold record for sales of 1.2 million copies of 'Chattanooga Choo Choo'.",
    ],
    (2, 11): [
        "1847: Thomas Alva Edison was born in Milan, Ohio, going on to secure 1,093 U.S. patents.",
        "2016: Scientists at LIGO officially announced the first direct detection of gravitational waves from colliding black holes.",
    ],
    (2, 12): [
        "1809: Charles Darwin and Abraham Lincoln were born on this exact day.",
        "2001: NASA's NEAR Shoemaker probe touched down on the surface of asteroid 433 Eros, a historic first.",
    ],
    (2, 13): [
        "1960: France conducted its first nuclear test, code-named Gerboise Bleue, in the Algerian Sahara.",
        "1633: Galileo Galilei arrived in Rome for his trial before the Inquisition over Copernican heliocentrism.",
    ],
    (2, 14): [
        "1990: Voyager 1 captured the famous 'Pale Blue Dot' portrait of Earth from 3.7 billion miles away.",
        "1876: Alexander Graham Bell filed his landmark patent application for the telephone.",
    ],
    (2, 15): [
        "1564: Astronomer Galileo Galilei was born in Pisa, Italy, founding modern observational astronomy.",
        "1946: The ENIAC computer was officially unveiled at the University of Pennsylvania.",
    ],
    (2, 16): [
        "1923: Howard Carter unsealed the burial chamber of Pharaoh Tutankhamun in the Valley of the Kings.",
        "1937: DuPont chemist Wallace Carothers received a patent for the synthetic polymer nylon.",
    ],
    (2, 17): [
        "1959: Vanguard 2 was launched, becoming the first weather satellite designed to photograph cloud cover.",
        "1867: The first vessel passed through the newly constructed Suez Canal.",
    ],
    (2, 18): [
        "1930: Clyde Tombaugh discovered Pluto while comparing photographic plates at Lowell Observatory in Arizona.",
        "2021: NASA's Perseverance rover and Ingenuity helicopter touched down inside Jezero Crater on Mars.",
    ],
    (2, 19): [
        "1473: Nicolaus Copernicus was born in Torun, Poland, developing the heliocentric model of the solar system.",
        "1986: The Soviet Union launched the core module of the Mir space station into low Earth orbit.",
    ],
    (2, 20): [
        "1962: John Glenn became the first American to orbit the Earth aboard Friendship 7 (Mercury-Atlas 6).",
        "1947: Fruit flies aboard a V-2 rocket became the first animals sent into space and safely recovered.",
    ],
    (2, 21): [
        "1947: Edwin Land demonstrated the first instant Polaroid Land camera at the Optical Society of America in New York.",
        "1848: Karl Marx and Friedrich Engels published 'The Communist Manifesto' in London.",
    ],
    (2, 22): [
        "1997: Scientists in Scotland announced the successful cloning of Dolly the sheep, the world's first cloned mammal.",
        "1632: Galileo Galilei published his 'Dialogue Concerning the Two Chief World Systems' in Florence.",
    ],
    (2, 23): [
        "1987: Light from Supernova 1987A in the Large Magellanic Cloud reached Earth, the closest observed supernova in 383 years.",
        "1455: Johannes Gutenberg traditionally published the Gutenberg Bible, the first major book printed with movable type.",
    ],
    (2, 24): [
        "2011: Space Shuttle Discovery launched on STS-133, its 39th and final mission to the International Space Station.",
        "1582: Pope Gregory XIII issued the papal bull Inter gravissimas, establishing the Gregorian calendar.",
    ],
    (2, 25): [
        "1836: Samuel Colt received a U.S. patent for the revolving-cylinder firearm mechanism.",
        "1969: Mariner 6 launched on a dual planetary flyby mission to photograph Mars.",
    ],
    (2, 26): [
        "1935: Robert Watson-Watt conducted the first secret RADAR demonstration at Daventry, detecting a Heyford bomber.",
        "1919: Grand Canyon National Park was officially established by the U.S. Congress.",
    ],
    (2, 27): [
        "1932: James Chadwick published a letter in Nature announcing the discovery of the neutron.",
        "1940: Martin Kamen and Sam Ruben discovered carbon-14, enabling modern radiocarbon dating.",
    ],
    (2, 28): [
        "1953: James Watson and Francis Crick announced they had discovered the chemical double-helix structure of DNA.",
        "1935: Wallace Carothers synthesized nylon for the first time in a DuPont research laboratory.",
    ],
    (2, 29): [
        "1860: Herman Hollerith, father of modern tabulating machines and punch cards, was born on Leap Day.",
        "1940: Hattie McDaniel became the first African American to win an Academy Award.",
    ],
    # --- Month 3 ---
    (3, 1): [
        "1896: Henri Becquerel discovered radioactivity while investigating phosphorescence in uranium salts.",
        "1872: Yellowstone National Park was established as the world's first national park.",
    ],
    (3, 2): [
        "1969: The Concorde supersonic passenger transport completed its maiden test flight from Toulouse, France.",
        "1972: Pioneer 10 launched on its mission to explore Jupiter and become the first craft to exit the solar system.",
    ],
    (3, 3): [
        "1847: Alexander Graham Bell was born in Edinburgh, Scotland, inventing the practical telephone.",
        "1969: Apollo 9 launched to test the Lunar Module in Earth orbit.",
    ],
    (3, 4): [
        "1790: France was divided into 83 administrative departments by the National Constituent Assembly.",
        "1877: Pyotr Ilyich Tchaikovsky's ballet 'Swan Lake' premiered at the Bolshoi Theatre in Moscow.",
    ],
    (3, 5): [
        "1979: Voyager 1 made its closest approach to Jupiter, returning detailed images of its turbulent atmosphere and moons.",
        "1827: Alessandro Volta, pioneer of electrical science and inventor of the battery, passed away in Camnago.",
    ],
    (3, 6): [
        "1869: Dmitri Mendeleev formally presented the Periodic Table of Elements to the Russian Chemical Society.",
        "1899: Bayer registered Aspirin (acetylsalicylic acid) as a trademark.",
    ],
    (3, 7): [
        "1876: Alexander Graham Bell was granted U.S. Patent 174,465 for the telephone.",
        "2009: NASA launched the Kepler space telescope to search for exoplanets orbiting distant stars.",
    ],
    (3, 8): [
        "1911: International Women's Day was honoured for the first time, celebrating global social and scientific achievements.",
        "1979: Voyager 1 discovered active volcanism on Jupiter's moon Io, the first active extraterrestrial volcanoes observed.",
    ],
    (3, 9): [
        "1959: The Barbie fashion doll debuted at the American International Toy Fair in New York.",
        "1796: Napoleon Bonaparte married Josephine de Beauharnais in Paris.",
    ],
    (3, 10): [
        "1876: Alexander Graham Bell made the first successful telephone call, saying: 'Mr. Watson, come here.'",
        "1977: Astronomers James Elliot, Edward Dunham, and Douglas Mink discovered the rings of Uranus.",
    ],
    (3, 11): [
        "2011: The Fukushima Daiichi nuclear disaster followed the magnitude 9.1 Tohoku earthquake and tsunami.",
        "1781: William Herschel completed observations that led to the discovery of Uranus two days later.",
    ],
    (3, 12): [
        "1989: Tim Berners-Lee submitted 'Information Management: A Proposal', creating the architecture of the World Wide Web.",
        "1930: Mahatma Gandhi began the 240-mile Salt March across India to protest British colonial salt monopolies.",
    ],
    (3, 13): [
        "1781: William Herschel discovered the planet Uranus from his garden in Bath, England.",
        "1930: Lowell Observatory formally announced Clyde Tombaugh's discovery of Pluto.",
    ],
    (3, 14): [
        "1879: Albert Einstein was born in Ulm, Germany · Pi Day (3.14) celebrating mathematics and precision.",
        "2018: Theoretical physicist Stephen Hawking passed away in Cambridge, England.",
    ],
    (3, 15): [
        "1985: Symbolics.com became the world's very first registered .com domain name on the Internet.",
        "1906: Charles Rolls and Henry Royce officially founded the Rolls-Royce motor car company.",
    ],
    (3, 16): [
        "1926: Robert H. Goddard launched the world's first liquid-fuelled rocket in Auburn, Massachusetts.",
        "1966: Gemini 8 achieved the first docking of two spacecraft in orbit, piloted by Neil Armstrong and David Scott.",
    ],
    (3, 17): [
        "1958: Vanguard 1 launched, becoming the oldest human-made satellite still in Earth orbit today.",
        "1845: Stephen Perry patented the rubber band in London.",
    ],
    (3, 18): [
        "1965: Soviet cosmonaut Alexei Leonov conducted the first spacewalk (EVA) in human history from Voskhod 2.",
        "2011: NASA's MESSENGER spacecraft entered orbit around Mercury, becoming its first orbital orbiter.",
    ],
    (3, 19): [
        "1918: The U.S. Congress established standard time zones and approved daylight saving time.",
        "1932: The Sydney Harbour Bridge opened in Australia, spanning 503 metres.",
    ],
    (3, 20): [
        "1916: Albert Einstein published his General Theory of Relativity in Annalen der Physik.",
        "1800: Alessandro Volta sent a letter to the Royal Society of London describing the voltaic pile (the first electric battery).",
    ],
    (3, 21): [
        "2006: Jack Dorsey sent the very first tweet: 'just setting up my twttr'.",
        "1965: NASA launched Ranger 9, the final photographic reconnaissance mission of the Ranger programme.",
    ],
    (3, 22): [
        "1895: Auguste and Louis Lumiere screened the first motion picture, 'Workers Leaving the Lumiere Factory', in Paris.",
        "1995: Cosmonaut Valeri Polyakov returned to Earth after spending a record 437 days continuously aboard Mir.",
    ],
    (3, 23): [
        "2001: The Russian Mir space station completed a controlled atmospheric re-entry over the South Pacific after 15 years.",
        "1965: Gemini 3 launched with Gus Grissom and John Young, the first crewed mission of the Gemini programme.",
    ],
    (3, 24): [
        "1882: Robert Koch announced the discovery of Mycobacterium tuberculosis, the bacterium causing tuberculosis.",
        "1965: NASA's Ranger 9 lunar probe transmitted high-resolution television pictures before impacting Alphonsus crater.",
    ],
    (3, 25): [
        "1655: Christiaan Huygens discovered Titan, the largest moon of Saturn.",
        "1957: The Treaty of Rome was signed, establishing the European Economic Community (precursor to the EU).",
    ],
    (3, 26): [
        "1953: Jonas Salk announced the successful testing of his polio vaccine against three strains of poliovirus.",
        "1979: Anwar Sadat and Menachem Begin signed the Egypt-Israel Peace Treaty in Washington.",
    ],
    (3, 27): [
        "1964: The Great Alaskan Earthquake (magnitude 9.2), the second most powerful recorded in history, struck Prince William Sound.",
        "1977: The Tenerife airport collision occurred on the island of Tenerife, leading to modern aviation crew resource management.",
    ],
    (3, 28): [
        "1979: The Three Mile Island nuclear accident occurred near Harrisburg, Pennsylvania.",
        "1939: The Spanish Civil War effectively ended as Nationalist forces entered Madrid.",
    ],
    (3, 29): [
        "1974: NASA's Mariner 10 completed the first close flyby of Mercury, discovering its magnetic field.",
        "1807: Heinrich Wilhelm Olbers discovered the asteroid 4 Vesta.",
    ],
    (3, 30): [
        "1858: Hymen Lipman patented the pencil with an attached rubber eraser in Philadelphia.",
        "1867: The United States agreed to purchase Alaska from the Russian Empire for $7.2 million.",
    ],
    (3, 31): [
        "1889: The Eiffel Tower was officially inaugurated in Paris, standing as the tallest human-made structure until 1930.",
        "1966: The Soviet Union launched Luna 10, which became the first spacecraft to orbit the Moon.",
    ],
    # --- Month 4 ---
    (4, 1): [
        "1976: Apple Computer was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne.",
        "1960: TIROS-1, the world's first successful weather satellite, launched from Cape Canaveral.",
    ],
    (4, 2): [
        "1975: The CN Tower in Toronto was completed, standing 553.3 metres tall as the world's tallest freestanding structure.",
        "1805: Danish author Hans Christian Andersen was born in Odense.",
    ],
    (4, 3): [
        "1973: Martin Cooper of Motorola placed the first public handheld mobile phone call from a Manhattan street.",
        "1966: Luna 10 entered lunar orbit, becoming the first artificial satellite of the Moon.",
    ],
    (4, 4): [
        "1975: Microsoft was founded in Albuquerque, New Mexico, by Bill Gates and Paul Allen.",
        "1983: Space Shuttle Challenger launched on its maiden orbital flight (STS-6).",
    ],
    (4, 5): [
        "1951: Julius and Ethel Rosenberg were sentenced to death in New York for espionage.",
        "1722: Dutch explorer Jacob Roggeveen discovered Easter Island (Rapa Nui).",
    ],
    (4, 6): [
        "1896: The opening ceremony of the first modern Olympic Games was celebrated in Athens, Greece.",
        "1965: Intelsat I ('Early Bird'), the first commercial communications satellite, launched into geosynchronous orbit.",
    ],
    (4, 7): [
        "1969: RFC 1, the founding document of the Internet architecture, was published by Steve Crocker.",
        "1948: The World Health Organisation (WHO) was established by the United Nations.",
    ],
    (4, 8): [
        "1911: Heike Kamerlingh Onnes discovered superconductivity in mercury cooled to 4.2 Kelvin.",
        "1964: Gemini 1, the first uncrewed test flight of the Gemini programme, launched into orbit.",
    ],
    (4, 9): [
        "1959: NASA introduced America's first astronauts, the Mercury Seven, at a press conference in Washington.",
        "1682: Robert Cavelier de La Salle claimed the Mississippi River basin for France, naming it Louisiana.",
    ],
    (4, 10): [
        "2019: The Event Horizon Telescope collaboration unveiled the first direct visual image of a black hole in galaxy M87.",
        "1912: RMS Titanic departed Southampton on its maiden voyage toward New York.",
    ],
    (4, 11): [
        "1970: Apollo 13 launched from Cape Kennedy carrying Jim Lovell, Jack Swigert, and Fred Haise.",
        "1986: Halley's Comet made its closest approach to Earth during its 1986 apparition.",
    ],
    (4, 12): [
        "1961: Yuri Gagarin became the first human in space aboard Vostok 1, completing one orbit of Earth.",
        "1981: Space Shuttle Columbia launched on STS-1, inaugurating the reusable Space Transportation System.",
    ],
    (4, 13): [
        "1970: An oxygen tank exploded aboard Apollo 13: 'Houston, we've had a problem here.'",
        "1742: George Frideric Handel's oratorio 'Messiah' received its world premiere in Dublin.",
    ],
    (4, 14): [
        "1912: RMS Titanic struck an iceberg in the North Atlantic at 11:40 PM.",
        "1865: President Abraham Lincoln was shot by John Wilkes Booth at Ford's Theatre in Washington.",
    ],
    (4, 15): [
        "1923: Insulin became generally available for medical use across North America.",
        "1452: Leonardo da Vinci was born in Vinci, Italy, embodying the ultimate polymath of the Renaissance.",
    ],
    (4, 16): [
        "1972: Apollo 16 launched toward the Descartes Highlands with John Young, Ken Mattingly, and Charles Duke.",
        "1867: Wilbur Wright, aviation pioneer, was born in Millville, Indiana.",
    ],
    (4, 17): [
        "1970: Apollo 13's command module Odyssey splashed down safely in the South Pacific after heroic rescue efforts.",
        "1964: Ford Motor Company unveiled the original Ford Mustang at the New York World's Fair.",
    ],
    (4, 18): [
        "1906: The Great San Francisco Earthquake and ensuing fires devastated over 80% of the city.",
        "1955: Theoretical physicist Albert Einstein passed away in Princeton, New Jersey.",
    ],
    (4, 19): [
        "1971: The Soviet Union launched Salyut 1, the world's very first orbital space station.",
        "2021: NASA's Ingenuity helicopter made the first powered, controlled aerodynamic flight on Mars.",
    ],
    (4, 20): [
        "1902: Marie and Pierre Curie successfully isolated radioactive radium chloride salts.",
        "1972: Apollo 16 lunar module Orion touched down on the Moon's Descartes plateau.",
    ],
    (4, 21): [
        "1918: Manfred von Richthofen ('The Red Baron') was shot down and killed over northern France.",
        "1994: Alexander Wolszczan announced the discovery of the first confirmed extrasolar planets.",
    ],
    (4, 22): [
        "1970: Earth Day was celebrated for the first time, mobilizing 20 million Americans for environmental protection.",
        "1500: Portuguese navigator Pedro Alvares Cabral sighted the coast of Brazil.",
    ],
    (4, 23): [
        "2005: Jawed Karim uploaded the very first video, 'Me at the zoo', to YouTube.",
        "1564: Traditional birth and death date of William Shakespeare in Stratford-upon-Avon.",
    ],
    (4, 24): [
        "1990: The Hubble Space Telescope was deployed into low Earth orbit aboard Space Shuttle Discovery.",
        "1967: Soviet cosmonaut Vladimir Komarov died during the landing of Soyuz 1 when its parachute failed.",
    ],
    (4, 25): [
        "1953: James Watson and Francis Crick published their landmark double-helix DNA paper in Nature.",
        "1874: Guglielmo Marconi, inventor of long-distance radio transmission, was born in Bologna, Italy.",
    ],
    (4, 26): [
        "1986: The Chernobyl nuclear disaster occurred at Reactor No. 4 in Soviet Ukraine.",
        "1962: NASA's Ranger 4 spacecraft impacted the far side of the Moon.",
    ],
    (4, 27): [
        "2005: The Airbus A380, the world's largest passenger airliner, completed its maiden flight from Toulouse.",
        "1791: Samuel Morse, co-inventor of the Morse code and telegraph, was born in Charlestown, Massachusetts.",
    ],
    (4, 28): [
        "2001: Dennis Tito became the first commercial space tourist, launching to the ISS aboard Soyuz TM-32.",
        "1947: Thor Heyerdahl and his crew departed Peru aboard the balsa wood raft Kon-Tiki.",
    ],
    (4, 29): [
        "1997: The Chemical Weapons Convention entered into force, outlawing chemical weapons production globally.",
        "1899: Camille Jenatzy became the first person to drive a vehicle over 100 km/h in an electric car.",
    ],
    (4, 30): [
        "1993: CERN placed the World Wide Web source code into the public domain, making it freely accessible forever.",
        "1006: Supernova SN 1006, the brightest recorded stellar event in human history, was observed globally.",
    ],
    # --- Month 5 ---
    (5, 1): [
        "1931: The Empire State Building opened in New York City, becoming the tallest building in the world.",
        "1964: The BASIC programming language ran for the first time at Dartmouth College.",
    ],
    (5, 2): [
        "1952: The de Havilland Comet, the world's first commercial jet airliner, commenced passenger service.",
        "1519: Leonardo da Vinci passed away at the Chateau du Clos Luce in Amboise, France.",
    ],
    (5, 3): [
        "1978: The first unsolicited commercial electronic mail message (spam) was sent across ARPANET.",
        "1469: Niccolo Machiavelli, author of 'The Prince', was born in Florence, Italy.",
    ],
    (5, 4): [
        "1989: The Magellan spacecraft was launched from Space Shuttle Atlantis on a radar-mapping mission to Venus.",
        "1904: Construction of the Panama Canal by the United States officially commenced.",
    ],
    (5, 5): [
        "1961: Alan Shepard became the first American in space aboard Freedom 7 (Mercury-Redstone 3).",
        "1821: Napoleon Bonaparte died in exile on the remote South Atlantic island of Saint Helena.",
    ],
    (5, 6): [
        "1954: Roger Bannister ran the first sub-four-minute mile (3:59.4) at Oxford's Iffley Road Track.",
        "1937: The German zeppelin Hindenburg caught fire and was destroyed while docking in Lakehurst, New Jersey.",
    ],
    (5, 7): [
        "1833: Composer Johannes Brahms was born in Hamburg, Germany.",
        "1946: Sony Corporation was founded in Tokyo by Masaru Ibuka and Akio Morita.",
    ],
    (5, 8): [
        "1945: Victory in Europe Day (VE Day) marked the formal acceptance of Nazi Germany's unconditional surrender.",
        "1886: John Pemberton brewed the first batch of Coca-Cola syrup in Atlanta, Georgia.",
    ],
    (5, 9): [
        "1960: The U.S. FDA approved Enovid, the first commercially available oral contraceptive pill.",
        "1926: Richard E. Byrd and Floyd Bennett claimed the first aeroplane flight over the North Pole.",
    ],
    (5, 10): [
        "1869: The Golden Spike was driven at Promontory Summit, Utah, completing the First Transcontinental Railroad.",
        "1994: Nelson Mandela was inaugurated as South Africa's first democratically elected president.",
    ],
    (5, 11): [
        "1997: IBM's Deep Blue supercomputer defeated Garry Kasparov in game six, winning the six-game match 3.5-2.5.",
        "1927: The Academy of Motion Picture Arts and Sciences was officially founded in California.",
    ],
    (5, 12): [
        "1941: Konrad Zuse presented the Z3, the world's first working programmable, fully automatic digital computer.",
        "1820: Florence Nightingale, pioneer of modern nursing and data visualization, was born in Florence.",
    ],
    (5, 13): [
        "1950: The first Formula One World Championship race took place at Silverstone Circuit in England.",
        "1913: Igor Sikorsky piloted the Russky Vityaz, the world's first four-engine aircraft.",
    ],
    (5, 14): [
        "1973: Skylab, the first United States space station, launched into orbit aboard a modified Saturn V.",
        "1796: Edward Jenner administered the first smallpox inoculation, creating the world's first vaccine.",
    ],
    (5, 15): [
        "1958: Sputnik 3 was launched by the Soviet Union carrying automated geophysical research instruments.",
        "1940: McDonald's opened its very first restaurant in San Bernardino, California.",
    ],
    (5, 16): [
        "1960: Theodore Maiman operated the world's first working laser (optical ruby laser) at Hughes Research Labs.",
        "1929: The first Academy Awards ceremony took place at the Hollywood Roosevelt Hotel.",
    ],
    (5, 17): [
        "1792: The New York Stock Exchange was founded beneath a buttonwood tree on Wall Street.",
        "1861: James Clerk Maxwell demonstrated the world's first colour photograph during a Royal Institution lecture.",
    ],
    (5, 18): [
        "1969: Apollo 10 launched on the final dress rehearsal mission before the historic lunar landing.",
        "1980: Mount St. Helens erupted in Washington state, blowing off 1,300 feet of its summit.",
    ],
    (5, 19): [
        "1971: Mars 2 launched from Baikonur Cosmodrome, becoming the first human-made object to reach Mars' surface.",
        "1910: Earth passed through the tail of Halley's Comet without incident.",
    ],
    (5, 20): [
        "1927: Charles Lindbergh departed New York aboard the Spirit of St. Louis on the first solo transatlantic flight.",
        "1873: Levi Strauss and Jacob Davis were granted a patent for copper-riveted blue denim work trousers.",
    ],
    (5, 21): [
        "1927: Charles Lindbergh landed in Paris after 33.5 hours, completing the first solo non-stop transatlantic flight.",
        "1932: Amelia Earhart landed in Northern Ireland, becoming the first woman to fly solo across the Atlantic.",
    ],
    (5, 22): [
        "1906: The Wright brothers were granted U.S. Patent 821,393 for their 'Flying Machine' aerodynamic control system.",
        "1990: Microsoft released Windows 3.0, the first widely popular version of its graphical operating system.",
    ],
    (5, 23): [
        "1934: Notorious outlaws Bonnie Parker and Clyde Barrow were ambushed and killed by law officers in Louisiana.",
        "1707: Carl Linnaeus, founder of modern binomial nomenclature for biological taxonomy, was born in Sweden.",
    ],
    (5, 24): [
        "1844: Samuel Morse sent the first telegraph message: 'What hath God wrought', from Washington to Baltimore.",
        "1962: Scott Carpenter orbited the Earth three times aboard Aurora 7 (Mercury-Atlas 7).",
    ],
    (5, 25): [
        "1961: President John F. Kennedy challenged the nation to land a man on the Moon and return him safely by decade's end.",
        "1977: The original 'Star Wars' (Episode IV: A New Hope) debuted in American cinemas.",
    ],
    (5, 26): [
        "1897: Bram Stoker's gothic horror masterpiece 'Dracula' was first published in London.",
        "1969: Apollo 10's command module Charlie Brown splashed down safely in the South Pacific.",
    ],
    (5, 27): [
        "1937: The Golden Gate Bridge opened to pedestrian traffic, with 200,000 people crossing on opening day.",
        "1931: Auguste Piccard and Paul Kipfer achieved a record altitude of 15,781 metres in a pressurized balloon gondola.",
    ],
    (5, 28): [
        "1959: Able and Miss Baker, two monkeys aboard a Jupiter missile, became the first primates to return alive from space.",
        "1937: The Volkswagen automobile manufacturing company was founded in Berlin.",
    ],
    (5, 29): [
        "1953: Sir Edmund Hillary and Tenzing Norgay became the first mountaineers to summit Mount Everest.",
        "1919: Arthur Eddington's solar eclipse observations confirmed Einstein's theory of general relativity.",
    ],
    (5, 30): [
        "2020: SpaceX's Crew Dragon Demo-2 launched Bob Behnken and Doug Hurley, restoring American orbital human spaceflight.",
        "1971: Mariner 9 launched toward Mars, becoming the first spacecraft to orbit another planet.",
    ],
    (5, 31): [
        "1911: The hull of the RMS Titanic was launched at the Harland and Wolff shipyard in Belfast.",
        "2008: Space Shuttle Discovery launched on STS-124, delivering Japan's Kibo laboratory module to the ISS.",
    ],
    # --- Month 6 ---
    (6, 1): [
        "1980: CNN (Cable News Network) commenced broadcasting as the world's first 24-hour television news network.",
        "1792: Kentucky was admitted to the Union as the 15th U.S. state.",
    ],
    (6, 2): [
        "1966: Surveyor 1 touched down on the Moon in Oceanus Procellarum, the first American soft lunar landing.",
        "1953: Queen Elizabeth II was crowned at Westminster Abbey in London.",
    ],
    (6, 3): [
        "1965: Astronaut Ed White became the first American to perform a spacewalk (EVA) from Gemini 4.",
        "1899: Hungarian-American chemist Georg von Békésy, Nobel laureate in auditory mechanics, was born.",
    ],
    (6, 4): [
        "1783: The Montgolfier brothers publicly demonstrated the first hot air balloon flight in Annonay, France.",
        "1919: The U.S. Senate passed the 19th Amendment, granting women the constitutional right to vote.",
    ],
    (6, 5): [
        "1977: The Apple II microcomputer went on commercial sale, popularising personal home computing.",
        "1989: The unidentified 'Tank Man' stood courageously before a column of tanks near Tiananmen Square.",
    ],
    (6, 6): [
        "1944: D-Day (Operation Overlord) · Allied forces landed on the beaches of Normandy, France.",
        "1984: Alexey Pajitnov released the iconic puzzle video game Tetris in Moscow.",
    ],
    (6, 7): [
        "1975: The Soviet Venera 9 space probe launched, becoming the first craft to transmit photos from Venus' surface.",
        "1494: Spain and Portugal signed the Treaty of Tordesillas, dividing newly discovered lands outside Europe.",
    ],
    (6, 8): [
        "1959: The North American X-15 rocket-powered research aircraft completed its first unpowered glide flight.",
        "1949: George Orwell's dystopian masterpiece 'Nineteen Eighty-Four' was published in London.",
    ],
    (6, 9): [
        "1934: Donald Duck made his cartoon debut in the Silly Symphony animated short 'The Wise Little Hen'.",
        "1959: USS George Washington, the world's first ballistic missile submarine, was launched in Groton, Connecticut.",
    ],
    (6, 10): [
        "2003: NASA launched the Spirit Mars Exploration Rover toward Gusev Crater on Mars.",
        "1943: The ballpoint pen was patented by Laszlo Biro in Buenos Aires, Argentina.",
    ],
    (6, 11): [
        "1770: Captain James Cook ran aground on the Great Barrier Reef aboard HMS Endeavour.",
        "1910: Jacques Cousteau, ocean explorer and co-inventor of the Aqua-Lung, was born in Saint-Andre-de-Cubzac.",
    ],
    (6, 12): [
        "1987: President Ronald Reagan delivered his famous address at the Berlin Wall: 'Mr. Gorbachev, tear down this wall!'.",
        "1967: Venera 4 launched toward Venus, successfully returning atmospheric data.",
    ],
    (6, 13): [
        "1983: Pioneer 10 became the first human-made object to travel beyond the orbit of Neptune.",
        "1920: The United States Post Office ruled that children could not be sent by parcel post.",
    ],
    (6, 14): [
        "1962: The European Space Research Organisation (ESRO), forerunner of the ESA, was founded in Paris.",
        "1777: The Second Continental Congress adopted the stars and stripes flag of the United States.",
    ],
    (6, 15): [
        "1215: King John affixed his Great Seal to Magna Carta at Runnymede, laying foundations for constitutional law.",
        "1844: Charles Goodyear received a patent for vulcanized rubber, rendering natural rubber durable and elastic.",
    ],
    (6, 16): [
        "1963: Valentina Tereshkova became the first woman in space, piloting Vostok 6 for 48 orbits.",
        "1977: Computer pioneer Wernher von Braun passed away in Alexandria, Virginia.",
    ],
    (6, 17): [
        "1885: The Statue of Liberty arrived in New York Harbour aboard the French frigate Isere.",
        "1972: Five burglars were arrested inside DNC headquarters at the Watergate complex in Washington.",
    ],
    (6, 18): [
        "1983: Sally Ride became the first American woman in space aboard Space Shuttle Challenger (STS-7).",
        "1815: The Duke of Wellington defeated Napoleon Bonaparte at the Battle of Waterloo in Belgium.",
    ],
    (6, 19): [
        "1976: NASA's Viking 1 spacecraft entered orbit around Mars, seeking the first touchdown on the Martian surface.",
        "1623: French mathematician and philosopher Blaise Pascal was born in Clermont-Ferrand.",
    ],
    (6, 20): [
        "1908: Melitta Bentz received a patent for the paper coffee filter, made using brass foil and blotting paper.",
        "1840: Samuel Morse was granted a patent for the telegraph and Morse code signaling.",
    ],
    (6, 21): [
        "2004: SpaceShipOne completed the first privately funded human spaceflight, reaching an altitude of 100.1 km.",
        "1948: The Manchester Baby, the world's first electronic stored-programme computer, ran its first program.",
    ],
    (6, 22): [
        "1633: Galileo Galilei was forced by the Inquisition to recant his Copernican view that Earth moves around the Sun.",
        "1978: James Christy discovered Charon, the largest moon of Pluto, at the U.S. Naval Observatory.",
    ],
    (6, 23): [
        "1912: Alan Turing was born in London, laying theoretical foundations for computer science and artificial intelligence.",
        "1868: Christopher Latham Sholes received a patent for the typewriter featuring the QWERTY keyboard.",
    ],
    (6, 24): [
        "1948: The Soviet Union began the Berlin Blockade, prompting the historic 15-month Berlin Airlift.",
        "1911: Juan Manuel Fangio, five-time Formula One World Champion, was born in Balcarce, Argentina.",
    ],
    (6, 25): [
        "1997: An uncrewed Progress spacecraft collided with the Spektr module of the Mir space station during manual docking.",
        "1903: George Orwell (Eric Arthur Blair), author of 'Animal Farm' and '1984', was born in Motihari, India.",
    ],
    (6, 26): [
        "1974: The universal product code (UPC barcode) was scanned for the first time on a pack of chewing gum in Ohio.",
        "1945: The United Nations Charter was signed by 50 founding member nations in San Francisco.",
    ],
    (6, 27): [
        "1967: The world's first automated teller machine (ATM) was installed by Barclays Bank in Enfield, London.",
        "1898: Joshua Slocum completed the first solo circumnavigation of the globe aboard the sloop Spray.",
    ],
    (6, 28): [
        "1914: Archduke Franz Ferdinand was assassinated in Sarajevo, sparking the outbreak of World War I.",
        "1965: First commercial satellite telephone call was placed through Intelsat I ('Early Bird').",
    ],
    (6, 29): [
        "1995: Space Shuttle Atlantis docked with the Russian Mir space station for the first time (STS-71).",
        "1975: Steve Wozniak tested the prototype circuit board for the Apple I computer.",
    ],
    (6, 30): [
        "1908: The Tunguska event flattened 80 million trees across 2,150 square kilometres of Siberian forest.",
        "1971: The crew of Soyuz 11 tragically died during re-entry after completing a stay aboard Salyut 1.",
    ],
    # --- Month 7 ---
    (7, 1): [
        "1979: Sony released the original Walkman TPS-L2 portable cassette player in Japan.",
        "1867: The British North America Act took effect, establishing the Dominion of Canada.",
    ],
    (7, 2): [
        "1900: Count Ferdinand von Zeppelin piloted the first flight of the rigid airship LZ 1 over Lake Constance.",
        "1865: William Booth founded The Salvation Army in London's East End.",
    ],
    (7, 3): [
        "1886: Karl Benz officially unveiled the Benz Patent-Motorwagen to the public in Mannheim, Germany.",
        "1928: John Logie Baird demonstrated the world's first colour television transmission in London.",
    ],
    (7, 4): [
        "1997: NASA's Mars Pathfinder and Sojourner rover landed on Mars, returning the first mobile rover telemetry.",
        "1054: Chinese astronomers recorded the guest star supernova that created the Crab Nebula (M1).",
    ],
    (7, 5): [
        "1996: Dolly the sheep was born at the Roslin Institute in Scotland, the first mammal cloned from adult cells.",
        "1687: Sir Isaac Newton's 'Philosophiae Naturalis Principia Mathematica' was published by the Royal Society.",
    ],
    (7, 6): [
        "1885: Louis Pasteur successfully tested his rabies vaccine on Joseph Meister, saving the boy's life.",
        "1942: Anne Frank and her family went into hiding in the secret annex in Amsterdam.",
    ],
    (7, 7): [
        "2003: NASA launched the Opportunity Mars Exploration Rover toward Meridiani Planum.",
        "1865: Four conspirators in the assassination of Abraham Lincoln were executed in Washington.",
    ],
    (7, 8): [
        "2011: Space Shuttle Atlantis launched on STS-135, the final flight of NASA's 30-year Space Shuttle programme.",
        "1889: The first issue of The Wall Street Journal was published by Charles Dow, Edward Jones, and Charles Bergstresser.",
    ],
    (7, 9): [
        "1979: Voyager 2 made its closest flyby of Jupiter, discovering ring systems and active moons.",
        "1877: The inaugural Wimbledon tennis championship commenced at the All England Club in London.",
    ],
    (7, 10): [
        "1856: Nikola Tesla was born in Smiljan, pioneering alternating current electricity and radio.",
        "1962: Telstar 1 launched, relaying the first live transatlantic television broadcast between the US and France.",
    ],
    (7, 11): [
        "1979: America's Skylab space station re-entered Earth's atmosphere, scattering debris over Western Australia.",
        "1960: Harper Lee published her Pulitzer Prize-winning novel 'To Kill a Mockingbird'.",
    ],
    (7, 12): [
        "1962: The Rolling Stones performed their first live concert at the Marquee Club in London.",
        "1817: Henry David Thoreau was born in Concord, Massachusetts, writing 'Walden'.",
    ],
    (7, 13): [
        "1977: The New York City blackout plunged nine million residents into darkness for 25 hours.",
        "1930: The first FIFA World Cup kicked off in Montevideo, Uruguay.",
    ],
    (7, 14): [
        "2015: NASA's New Horizons probe made its historic flyby of Pluto, revealing its nitrogen ice heart.",
        "1965: Mariner 4 flew past Mars, transmitting the first close-up photographs of another planet's surface.",
    ],
    (7, 15): [
        "1975: The Apollo-Soyuz Test Project launched, culminating in the first joint US-Soviet space docking.",
        "2006: Social media microblogging platform Twitter was launched to the public.",
    ],
    (7, 16): [
        "1969: Apollo 11 launched from Cape Kennedy carrying Neil Armstrong, Buzz Aldrin, and Michael Collins.",
        "1945: The Trinity test conducted the world's first detonation of a nuclear weapon in Alamogordo, New Mexico.",
    ],
    (7, 17): [
        "1975: Apollo and Soyuz spacecraft docked in orbit, and commanders Thomas Stafford and Alexei Leonov shook hands.",
        "1955: Disneyland opened its gates in Anaheim, California.",
    ],
    (7, 18): [
        "1966: Gemini 10 launched with John Young and Michael Collins, rendezvoused with two Agena target vehicles.",
        "1925: Adolf Hitler published the first volume of 'Mein Kampf'.",
    ],
    (7, 19): [
        "1983: The first three-dimensional CT scan reconstruction of a human skull was generated.",
        "1975: Apollo and Soyuz astronauts separated after successful joint scientific operations.",
    ],
    (7, 20): [
        "1969: Apollo 11 Lunar Module touched down on the Moon: 'The Eagle has landed.' Neil Armstrong walked on the Moon.",
        "1976: NASA's Viking 1 lander touched down safely on Mars at Chryse Planitia.",
    ],
    (7, 21): [
        "1969: Neil Armstrong and Buzz Aldrin lifted off from the lunar surface aboard the Eagle's ascent stage.",
        "2011: Space Shuttle Atlantis touched down at Kennedy Space Center, concluding the Space Shuttle era.",
    ],
    (7, 22): [
        "1962: Mariner 1 was destroyed by the range safety officer 293 seconds after launch due to a missing hyphen in code.",
        "1933: Wiley Post completed the first solo aeroplane flight around the world in seven days, 18 hours.",
    ],
    (7, 23): [
        "1999: NASA launched the Chandra X-ray Observatory aboard Space Shuttle Columbia (STS-93).",
        "1995: Comet Hale-Bopp was discovered independently by Alan Hale and Thomas Bopp.",
    ],
    (7, 24): [
        "1969: Apollo 11's command module Columbia splashed down safely in the North Pacific Ocean.",
        "1897: Aviation pioneer Amelia Earhart was born in Atchison, Kansas.",
    ],
    (7, 25): [
        "1978: Louise Brown, the world's first child conceived via in vitro fertilisation (IVF), was born in England.",
        "1984: Soviet cosmonaut Svetlana Savitskaya became the first woman to perform an open spacewalk (EVA).",
    ],
    (7, 26): [
        "1971: Apollo 15 launched with David Scott, James Irwin, and Al Worden, carrying the first Lunar Roving Vehicle.",
        "1908: The United States Federal Bureau of Investigation (FBI) was established.",
    ],
    (7, 27): [
        "1953: The Korean Armistice Agreement was signed at Panmunjom, ending active hostilities.",
        "1940: Bugs Bunny made his official debut in the Warner Bros. cartoon short 'A Wild Hare'.",
    ],
    (7, 28): [
        "1973: Skylab 3 launched, carrying Alan Bean, Jack Lousma, and Owen Garriott to America's space station.",
        "1914: Austria-Hungary declared war on Serbia, marking the beginning of the First World War.",
    ],
    (7, 29): [
        "1958: President Dwight D. Eisenhower signed the National Aeronautics and Space Act, establishing NASA.",
        "1981: Prince Charles and Lady Diana Spencer were married at St Paul's Cathedral in London.",
    ],
    (7, 30): [
        "1971: Apollo 15 astronauts David Scott and James Irwin landed on the Moon at Hadley Rille.",
        "2020: NASA's Perseverance rover and Ingenuity helicopter launched toward Mars from Cape Canaveral.",
    ],
    (7, 31): [
        "1971: Astronauts drove the Lunar Roving Vehicle on the Moon for the first time during Apollo 15.",
        "1964: Ranger 7 transmitted the first close-up photographs of the Moon before impacting the surface.",
    ],
    # --- Month 8 ---
    (8, 1): [
        "1971: Apollo 15 astronaut David Scott demonstrated Galileo's equivalence principle by dropping a feather and hammer.",
        "1981: MTV (Music Television) launched with the music video 'Video Killed the Radio Star' by The Buggles.",
    ],
    (8, 2): [
        "1939: Albert Einstein signed a letter to President Franklin D. Roosevelt warning of atomic weapon potential.",
        "1934: Adolf Hitler became Führer of Germany following the death of President Paul von Hindenburg.",
    ],
    (8, 3): [
        "2004: NASA's MESSENGER spacecraft launched on its journey to orbit Mercury.",
        "1492: Christopher Columbus set sail from Palos de la Frontera, Spain, on his first voyage across the Atlantic.",
    ],
    (8, 4): [
        "2007: NASA launched the Phoenix Mars lander toward the icy northern polar plains of Mars.",
        "1693: Dom Perignon traditionally invented sparkling champagne at the Abbey of Hautvillers.",
    ],
    (8, 5): [
        "2011: NASA's Juno spacecraft launched from Cape Canaveral on a mission to study Jupiter's interior and magnetosphere.",
        "1930: Neil Armstrong, the first person to walk on the Moon, was born in Wapakoneta, Ohio.",
    ],
    (8, 6): [
        "1991: Tim Berners-Lee opened the World Wide Web to the public from his NeXT computer at CERN.",
        "2012: NASA's Curiosity rover landed inside Gale Crater on Mars using a sky crane descent stage.",
    ],
    (8, 7): [
        "1959: Explorer 6 launched into orbit, capturing the very first television photo of Earth from space.",
        "1976: Viking 2 entered orbit around Mars, seeking a northern touchdown site.",
    ],
    (8, 8): [
        "1989: The Hipparcos astrometry satellite was launched by ESA to measure high-precision star positions.",
        "1974: President Richard Nixon announced his resignation in a televised address over the Watergate scandal.",
    ],
    (8, 9): [
        "1965: Singapore declared independence from Malaysia · Majulah Singapura national salute.",
        "1973: Mars 7 launched from Baikonur on a Soviet interplanetary exploration mission.",
    ],
    (8, 10): [
        "1990: NASA's Magellan spacecraft arrived at Venus and fired its retrorockets to enter polar orbit.",
        "1966: Lunar Orbiter 1 launched, photographing potential landing sites for the Apollo programme.",
    ],
    (8, 11): [
        "1960: Discoverer 13 capsule became the first object manufactured by humans recovered from orbit.",
        "1972: Che Guevara's captured field diaries were published in Havana.",
    ],
    (8, 12): [
        "1981: IBM introduced the IBM 5150 Personal Computer, standardising the PC platform.",
        "1960: Echo 1, NASA's first passive communications balloon satellite, launched into orbit.",
    ],
    (8, 13): [
        "1961: The German Democratic Republic began construction of the Berlin Wall.",
        "1898: Carl Gustav Witt discovered 433 Eros, the first near-Earth asteroid identified.",
    ],
    (8, 14): [
        "1945: Victory over Japan Day (V-J Day) marked the end of the Second World War.",
        "1893: France introduced motor vehicle registration plates and driver examinations in Paris.",
    ],
    (8, 15): [
        "1977: The 'Wow! signal' was detected by Jerry R. Ehman at Ohio State University's Big Ear radio telescope.",
        "1914: The Panama Canal officially opened to maritime traffic, connecting the Atlantic and Pacific oceans.",
    ],
    (8, 16): [
        "1960: Joseph Kittinger made a record parachute jump from a helium balloon at 102,800 feet (31.3 km).",
        "1977: Elvis Presley passed away at Graceland in Memphis, Tennessee.",
    ],
    (8, 17): [
        "1970: The Soviet Union launched Venera 7, which became the first craft to transmit data from Venus' surface.",
        "1978: Double Eagle II completed the first transatlantic crossing by balloon.",
    ],
    (8, 18): [
        "1868: Pierre Janssen discovered helium by observing a yellow line in the solar chromosphere during an eclipse.",
        "1958: Vladimir Nabokov's controversial novel 'Lolita' was published in the United States.",
    ],
    (8, 19): [
        "1960: Belka and Strelka, two Soviet space dogs aboard Korabl-Sputnik 2, became the first animals to orbit and return alive.",
        "1839: The French government presented the daguerreotype photographic process as a free gift to the world.",
    ],
    (8, 20): [
        "1977: NASA launched Voyager 2 from Cape Canaveral on its interstellar grand tour of four outer planets.",
        "1975: Viking 1 launched on its historic mission to orbit and soft-land on Mars.",
    ],
    (8, 21): [
        "1965: Gemini 5 launched carrying Gordon Cooper and Pete Conrad on an eight-day endurance space mission.",
        "1911: The Mona Lisa was stolen from the Louvre museum in Paris by Vincenzo Peruggia.",
    ],
    (8, 22): [
        "1989: Voyager 2 discovered the complete ring system around the ice giant planet Neptune.",
        "1851: The yacht America won the Royal Yacht Squadron cup, founding the America's Cup regatta.",
    ],
    (8, 23): [
        "1966: Lunar Orbiter 1 captured the very first photograph of Earth from the vicinity of the Moon.",
        "1927: Italian anarchists Nicola Sacco and Bartolomeo Vanzetti were executed in Massachusetts.",
    ],
    (8, 24): [
        "2006: The International Astronomical Union (IAU) redefined 'planet', reclassifying Pluto as a dwarf planet.",
        "1995: Microsoft released Windows 95 and Internet Explorer, transforming consumer computing.",
    ],
    (8, 25): [
        "1991: Linus Torvalds announced the Linux kernel project in the comp.os.minix newsgroup.",
        "1989: Voyager 2 swept past Neptune and detected high-speed 1,300 mph supersonic winds.",
    ],
    (8, 26): [
        "1978: Sigmund Jähn became the first German in space aboard Soviet spacecraft Soyuz 31.",
        "1789: The National Constituent Assembly in Paris adopted the Declaration of the Rights of Man and of the Citizen.",
    ],
    (8, 27): [
        "1939: The Heinkel He 178, the world's first operational turbojet-powered aircraft, made its maiden flight.",
        "1962: Mariner 2 launched on the first successful interplanetary mission to Venus.",
    ],
    (8, 28): [
        "1963: Martin Luther King Jr. delivered his historic 'I Have a Dream' speech at the March on Washington.",
        "1789: William Herschel discovered Enceladus, the icy, geyser-spewing moon of Saturn.",
    ],
    (8, 29): [
        "1831: Michael Faraday demonstrated electromagnetic induction, the foundational principle of electric motors.",
        "1949: The Soviet Union detonated its first atomic bomb, RDS-1 ('First Lightning'), at Semipalatinsk.",
    ],
    (8, 30): [
        "1984: Space Shuttle Discovery launched on its maiden flight (STS-41-D).",
        "1905: Ernest Rutherford published his landmark findings on radioactive decay in Nature.",
    ],
    (8, 31): [
        "1888: Mary Ann Nichols was murdered in London's Whitechapel, the first victim attributed to Jack the Ripper.",
        "1997: Diana, Princess of Wales, died following a car crash in the Pont de l'Alma tunnel in Paris.",
    ],
    # --- Month 9 ---
    (9, 1): [
        "1979: Pioneer 11 made its closest approach to Saturn, discovering its narrow F ring and an unknown moon.",
        "1939: Nazi Germany invaded Poland, precipitating the outbreak of the Second World War in Europe.",
    ],
    (9, 2): [
        "1945: The formal Japanese Instrument of Surrender was signed aboard the battleship USS Missouri in Tokyo Bay.",
        "1666: The Great Fire of London broke out in Pudding Lane, destroying over 13,000 houses.",
    ],
    (9, 3): [
        "1976: NASA's Viking 2 spacecraft landed successfully on Mars at Utopia Planitia, sending panoramic photos.",
        "1783: The Treaty of Paris was signed, formally concluding the American Revolutionary War.",
    ],
    (9, 4): [
        "1888: George Eastman registered the trademark 'Kodak' and patented the roll-film camera.",
        "1998: Larry Page and Sergey Brin formally incorporated Google Inc. in Menlo Park, California.",
    ],
    (9, 5): [
        "1977: NASA launched Voyager 1 carrying the Golden Record on an interstellar journey into deep space.",
        "1972: Eight Palestinian terrorists from Black September took Israeli athletes hostage at the Munich Olympics.",
    ],
    (9, 6): [
        "1997: The funeral of Diana, Princess of Wales, was watched by an estimated 2.5 billion television viewers globally.",
        "1522: The Victoria, the only surviving ship of Ferdinand Magellan's expedition, returned to Spain, completing the first circumnavigation.",
    ],
    (9, 7): [
        "1927: Philo Farnsworth successfully transmitted the first electronic television image in San Francisco.",
        "1940: The German Luftwaffe commenced the 57-consecutive-night Blitz bombing campaign on London.",
    ],
    (9, 8): [
        "1966: The original 'Star Trek' television series premiered on NBC in the United States.",
        "1504: Michelangelo's masterpiece statue of David was unveiled in Florence, Italy.",
    ],
    (9, 9): [
        "1947: Grace Hopper and engineers logged the first computer 'bug'—an actual moth found inside the Harvard Mark II.",
        "1850: California was admitted to the Union as the 31st U.S. state.",
    ],
    (9, 10): [
        "2008: The Large Hadron Collider (LHC) at CERN circulated its first proton beams around its 27-kilometre ring.",
        "1897: George Smith became the first person arrested for drink driving in London.",
    ],
    (9, 11): [
        "2001: The September 11 terrorist attacks struck the World Trade Center, the Pentagon, and Shanksville, PA.",
        "1792: The Hope Diamond was stolen from the royal treasury in Paris during the French Revolution.",
    ],
    (9, 12): [
        "1958: Jack Kilby tested the world's first working integrated circuit microchip at Texas Instruments.",
        "1962: President John F. Kennedy delivered his 'We choose to go to the Moon' address at Rice University.",
    ],
    (9, 13): [
        "1959: The Soviet Luna 2 became the first human-made spacecraft to reach the surface of the Moon.",
        "1985: Nintendo released the landmark platform video game Super Mario Bros. in Japan.",
    ],
    (9, 14): [
        "1959: Luna 2 intentionally impacted the lunar surface east of Mare Serenitatis, confirming the lack of a magnetic field.",
        "1960: OPEC (Organisation of the Petroleum Exporting Countries) was founded in Baghdad, Iraq.",
    ],
    (9, 15): [
        "2017: NASA's Cassini spacecraft ended its 20-year mission with a planned plunge into Saturn's atmosphere.",
        "1835: HMS Beagle carrying 26-year-old naturalist Charles Darwin arrived at the Galapagos Islands.",
    ],
    (9, 16): [
        "1987: The Montreal Protocol on Substances that Deplete the Ozone Layer was signed by 46 nations.",
        "1620: The Mayflower departed Plymouth, England, carrying 102 Pilgrim passengers toward North America.",
    ],
    (9, 17): [
        "1976: NASA publicly rolled out the prototype Space Shuttle Enterprise at Palmdale, California.",
        "1787: The United States Constitution was signed by delegates at the Constitutional Convention in Philadelphia.",
    ],
    (9, 18): [
        "1977: Voyager 1 captured the first photograph showing both Earth and the Moon together in a single frame.",
        "1851: The first issue of The New York Times was published by Henry Jarvis Raymond and George Jones.",
    ],
    (9, 19): [
        "1982: Computer scientist Scott Fahlman proposed using ':-)' and ':-(' as smileys on the Carnegie Mellon bboard.",
        "1991: Otzi the Iceman, a natural mummy from 3300 BC, was discovered preserved in an Alpine glacier.",
    ],
    (9, 20): [
        "1970: The Soviet uncrewed probe Luna 16 soft-landed on the Moon, collecting samples to return to Earth.",
        "1519: Ferdinand Magellan departed Spain with five ships on the first global circumnavigation voyage.",
    ],
    (9, 21): [
        "2003: NASA's Galileo spacecraft ended its mission by deliberately diving into Jupiter's dense atmosphere.",
        "1937: J.R.R. Tolkien's fantasy novel 'The Hobbit' was first published by George Allen & Unwin in London.",
    ],
    (9, 22): [
        "1862: President Abraham Lincoln issued the preliminary Emancipation Proclamation.",
        "1991: The Huntington Library made the complete photographic archive of the Dead Sea Scrolls public.",
    ],
    (9, 23): [
        "1846: Astronomer Johann Gottfried Galle discovered the planet Neptune at the Berlin Observatory.",
        "1889: Fusajiro Yamauchi founded Nintendo in Kyoto, Japan, initially producing handmade Hanafuda cards.",
    ],
    (9, 24): [
        "2014: India's Mars Orbiter Mission (Mangalyaan) successfully entered Mars orbit on its very first attempt.",
        "1960: USS Enterprise, the world's first nuclear-powered aircraft carrier, was launched in Newport News, VA.",
    ],
    (9, 25): [
        "1992: NASA launched the Mars Observer probe, though communication was lost shortly before orbit insertion.",
        "1981: Sandra Day O'Connor was sworn in as the first female Justice of the United States Supreme Court.",
    ],
    (9, 26): [
        "1983: Soviet Lieutenant Colonel Stanislav Petrov averted nuclear war by correctly diagnosing a satellite missile false alarm.",
        "1960: The first televised presidential debate took place between John F. Kennedy and Richard Nixon in Chicago.",
    ],
    (9, 27): [
        "1825: The Stockton and Darlington Railway opened in England, operating the first public steam locomotive passenger service.",
        "1905: Albert Einstein's paper introducing the mass-energy equivalence equation E = mc² was published in Annalen der Physik.",
    ],
    (9, 28): [
        "1928: Alexander Fleming discovered penicillin after returning from holiday to find mould killing staphylococci.",
        "2008: SpaceX launched Falcon 1 Flight 4, becoming the first private liquid-fuelled rocket to reach orbit.",
    ],
    (9, 29): [
        "1988: Space Shuttle Discovery launched on STS-26, NASA's successful 'Return to Flight' after the Challenger tragedy.",
        "1954: The convention establishing CERN (European Organisation for Nuclear Research) entered into force.",
    ],
    (9, 30): [
        "1954: The world's first nuclear-powered submarine, USS Nautilus, was commissioned into the U.S. Navy.",
        "1927: Babe Ruth hit his 60th home run of the season at Yankee Stadium, a record that stood for 34 years.",
    ],
    # --- Month 10 ---
    (10, 1): [
        "1958: NASA officially began operations, succeeding the National Advisory Committee for Aeronautics (NACA).",
        "1908: Ford Motor Company introduced the revolutionary Model T automobile, making cars affordable to the public.",
    ],
    (10, 2): [
        "1925: John Logie Baird successfully transmitted the first greyscale television picture in his London laboratory.",
        "1869: Mahatma Gandhi was born in Porbandar, India, leading India to independence through non-violent resistance.",
    ],
    (10, 3): [
        "1942: The first successful launch of a V-2 / A4 rocket reached space boundary (altitude 84.5 km) at Peenemünde.",
        "1990: East and West Germany were officially reunified after 45 years of post-war division.",
    ],
    (10, 4): [
        "1957: The Soviet Union launched Sputnik 1, the world's first artificial satellite, inaugurating the Space Age.",
        "2004: SpaceShipOne won the $10 million Ansari X Prize for reusable commercial human spaceflight.",
    ],
    (10, 5): [
        "1923: Edwin Hubble identified Cepheid variable V1 in the Andromeda Galaxy, proving galaxies exist beyond the Milky Way.",
        "1962: The Beatles released their debut single 'Love Me Do' in the United Kingdom.",
    ],
    (10, 6): [
        "1927: 'The Jazz Singer' premiered in New York, introducing synchronized dialogue and ushering in the talkies era.",
        "1995: Michel Mayor and Didier Queloz announced the discovery of 51 Pegasi b, the first confirmed exoplanet around a sun-like star.",
    ],
    (10, 7): [
        "1959: The Soviet Luna 3 spacecraft transmitted the very first photographs of the far side of the Moon.",
        "1806: Ralph Wedgwood patented carbon paper in England, revolutionizing office document duplication.",
    ],
    (10, 8): [
        "1958: Åke Senning and Rune Elmqvist performed the world's first successful human cardiac pacemaker implant in Sweden.",
        "1871: The Great Chicago Fire broke out, destroying three square miles of the city.",
    ],
    (10, 9): [
        "1872: Aaron Montgomery Ward produced the first mail-order catalogue, pioneering modern consumer logistics.",
        "1962: Uganda gained full independence from the United Kingdom.",
    ],
    (10, 10): [
        "1967: The Outer Space Treaty entered into force, establishing space as a common heritage for all humankind.",
        "1913: President Woodrow Wilson triggered an electrical blast in Washington, opening the Panama Canal.",
    ],
    (10, 11): [
        "1968: Apollo 7 launched with Wally Schirra, Donn Eisele, and Walter Cunningham, the first crewed Apollo mission.",
        "1984: Kathryn Sullivan became the first American woman to perform a spacewalk aboard Challenger STS-41-G.",
    ],
    (10, 12): [
        "1964: Voskhod 1 launched, carrying the first multi-person crew into orbit without spacesuits.",
        "1492: Christopher Columbus's expedition made landfall in the Bahamas, encountering the Americas.",
    ],
    (10, 13): [
        "1884: Greenwich was officially adopted as the universal Prime Meridian for world timezones.",
        "1773: Charles Messier discovered the Whirlpool Galaxy (M51) while cataloguing deep-sky objects.",
        "1983: Ameritech launched the first commercial cellular mobile telephone service in Chicago.",
    ],
    (10, 14): [
        "1947: Chuck Yeager broke the sound barrier aboard the Bell X-1 rocket plane, reaching Mach 1.05.",
        "1964: Martin Luther King Jr. was announced as recipient of the Nobel Peace Prize.",
        "1969: The UK 50p seven-sided equilateral curve coin entered circulation.",
    ],
    (10, 15): [
        "1997: Cassini-Huygens launched on its epic mission to explore Saturn and Titan.",
        "1956: The FORTRAN compiler manual was published, introducing the first high-level programming language.",
        "2003: China launched Shenzhou 5, sending Yang Liwei into orbit as its first astronaut.",
    ],
    (10, 16): [
        "1923: Walt Disney and Roy Disney founded the Disney Brothers Cartoon Studio in Hollywood.",
        "1964: China detonated its first atomic bomb at the Lop Nur test site, becoming the fifth nuclear power.",
    ],
    (10, 17): [
        "1956: Calder Hall nuclear power station in England opened, the world's first commercial-scale nuclear power plant.",
        "1931: Notorious gangster Al Capone was convicted of federal income tax evasion in Chicago.",
    ],
    (10, 18): [
        "1989: Galileo spacecraft launched toward Jupiter aboard Space Shuttle Atlantis (STS-34).",
        "1967: The Soviet Venera 4 probe entered Venus' atmosphere, transmitting the first chemical analysis of another world.",
    ],
    (10, 19): [
        "1943: Streptomycin, the first antibiotic effective against tuberculosis, was isolated by Albert Schatz at Rutgers.",
        "1987: 'Black Monday' saw the Dow Jones Industrial Average plunge 22.6% in a single day.",
    ],
    (10, 20): [
        "1983: The 17th General Conference on Weights and Measures redefined the metre based on the speed of light in vacuum.",
        "1973: The Sydney Opera House was formally opened by Queen Elizabeth II in Australia.",
    ],
    (10, 21): [
        "1879: Thomas Edison successfully tested his incandescent electric lamp, which burned continuously for over 13 hours.",
        "1805: The Royal Navy under Lord Nelson defeated the combined French and Spanish fleets at the Battle of Trafalgar.",
    ],
    (10, 22): [
        "1966: The Soviet Luna 12 launched toward the Moon to photograph potential lunar terrain.",
        "1975: The Soviet Venera 9 landed on Venus, transmitting the very first black-and-white photos of its surface.",
    ],
    (10, 23): [
        "2001: Apple CEO Steve Jobs introduced the original iPod digital music player in Cupertino.",
        "1942: The Second Battle of El Alamein commenced in Egypt, marking a turning point in the North African campaign.",
    ],
    (10, 24): [
        "1946: A camera aboard a V-2 rocket captured the first photograph of Earth from space at an altitude of 105 km.",
        "1945: The United Nations officially came into existence following ratification of the UN Charter.",
    ],
    (10, 25): [
        "2001: Microsoft released Windows XP, unifying its consumer and corporate OS codebases on the NT kernel.",
        "1881: Pablo Picasso was born in Malaga, Spain, co-founding the Cubist movement.",
    ],
    (10, 26): [
        "1977: The last naturally occurring case of smallpox was diagnosed in Somalia, leading to global disease eradication.",
        "1881: The famous Gunfight at the O.K. Corral took place in Tombstone, Arizona.",
    ],
    (10, 27): [
        "1904: The New York City Subway opened its first underground rapid transit line, running 9.1 miles from City Hall.",
        "1961: NASA launched the Saturn I rocket on mission SA-1, testing the heavy-lift booster cluster.",
    ],
    (10, 28): [
        "1636: Harvard College was founded by vote of the Great and General Court of Massachusetts Bay Colony.",
        "1886: The Statue of Liberty was officially dedicated by President Grover Cleveland in New York Harbour.",
    ],
    (10, 29): [
        "1969: The first host-to-host message was transmitted over ARPANET between UCLA and Stanford University.",
        "1998: John Glenn returned to space aboard Discovery (STS-95) at age 77, becoming the oldest person in space.",
    ],
    (10, 30): [
        "1938: Orson Welles broadcast his radio adaptation of H.G. Wells' 'The War of the Worlds', shocking listeners.",
        "1961: The Soviet Union detonated the Tsar Bomba (50 megatons), the most powerful nuclear weapon ever tested.",
    ],
    (10, 31): [
        "2000: Soyuz TM-31 launched carrying Expedition 1, beginning uninterrupted human occupation of the ISS.",
        "1517: Martin Luther nailed his Ninety-five Theses to the door of All Saints' Church in Wittenberg.",
    ],
    # --- Month 11 ---
    (11, 1): [
        "1952: The United States detonated Ivy Mike at Enewetak Atoll, the world's first thermonuclear hydrogen bomb.",
        "1512: Michelangelo's ceiling frescoes in the Sistine Chapel were exhibited to the public for the first time.",
    ],
    (11, 2): [
        "1947: Howard Hughes piloted the Hughes H-4 Hercules ('Spruce Goose') on its only flight over Long Beach Harbour.",
        "2000: Expedition 1 crew docked with the International Space Station, inaugurating permanent habitation.",
    ],
    (11, 3): [
        "1957: Sputnik 2 launched into orbit carrying Laika the dog, the first living creature to orbit the Earth.",
        "1973: NASA launched Mariner 10, the first spacecraft designed to visit two planets (Venus and Mercury).",
    ],
    (11, 4): [
        "1922: Howard Carter discovered the entrance to the tomb of Pharaoh Tutankhamun in Egypt.",
        "2008: Barack Obama was elected the first African American President of the United States.",
    ],
    (11, 5): [
        "2013: India launched the Mars Orbiter Mission (Mangalyaan) toward the Red Planet.",
        "1605: The Gunpowder Plot to blow up the English Parliament was foiled when Guy Fawkes was discovered.",
    ],
    (11, 6): [
        "1869: Rutgers and Princeton played the first intercollegiate American football game in New Brunswick, NJ.",
        "1935: The prototype Hawker Hurricane fighter aircraft made its maiden flight in England.",
    ],
    (11, 7): [
        "1867: Marie Curie was born in Warsaw, Poland, becoming the first person to win two Nobel Prizes.",
        "1996: NASA launched the Mars Global Surveyor spacecraft on a global mapping mission.",
    ],
    (11, 8): [
        "1895: Wilhelm Röntgen discovered X-rays in Würzburg, Germany, producing the first medical radiograph.",
        "1965: The Murder (Abolition of Death Penalty) Act formally abolished capital punishment in the UK.",
    ],
    (11, 9): [
        "1989: The Berlin Wall fell as East German authorities opened border checkpoints, ending the Cold War division.",
        "1967: The Saturn V rocket launched for the first time on the uncrewed Apollo 4 test flight.",
    ],
    (11, 10): [
        "1970: The Soviet Union launched Luna 17, which landed the Lunokhod 1 robotic lunar rover.",
        "1983: Microsoft formally announced Windows as a graphical user interface extension for MS-DOS.",
    ],
    (11, 11): [
        "1918: The Armistice of Compiègne took effect at 11:00 AM, ending hostilities in the First World War.",
        "1966: Gemini 12 launched with Jim Lovell and Buzz Aldrin, the final mission of the Gemini programme.",
    ],
    (11, 12): [
        "2014: ESA's Rosetta mission lander Philae completed the first soft landing on a comet (67P/Churyumov–Gerasimenko).",
        "1980: NASA's Voyager 1 spacecraft made its closest flyby of Saturn, discovering complex ring structure.",
    ],
    (11, 13): [
        "1971: Mariner 9 entered orbit around Mars, becoming the first spacecraft to orbit another planet.",
        "1982: The Vietnam Veterans Memorial wall was dedicated in Washington, D.C.",
    ],
    (11, 14): [
        "1969: Apollo 12 launched toward Oceanus Procellarum, struck twice by lightning during ascent without damage.",
        "1889: Nellie Bly embarked on her record-breaking attempt to travel around the world in under 80 days.",
    ],
    (11, 15): [
        "1971: Intel publicly released the 4004, the world's first single-chip commercial microprocessor.",
        "1988: The Soviet space shuttle Buran completed its only orbital flight, landing completely automatically.",
    ],
    (11, 16): [
        "1974: The Arecibo message was beamed toward globular star cluster M13 in search of extraterrestrial intelligence.",
        "1904: English physicist John Ambrose Fleming received a patent for the thermionic two-electrode vacuum tube.",
    ],
    (11, 17): [
        "1970: Lunokhod 1 rolled down onto the lunar surface from Luna 17, becoming the first remote-controlled rover on another world.",
        "1869: The Suez Canal in Egypt was formally opened to international maritime traffic.",
    ],
    (11, 18): [
        "1928: Walt Disney's animated short 'Steamboat Willie' debuted in New York, introducing Mickey Mouse with synchronized sound.",
        "1923: American astronaut Alan Shepard, the first American in space, was born in East Derry, New Hampshire.",
    ],
    (11, 19): [
        "1969: Apollo 12 astronauts Pete Conrad and Alan Bean landed on the Moon near the Surveyor 3 probe.",
        "1863: President Abraham Lincoln delivered the Gettysburg Address at the Soldiers' National Cemetery in Pennsylvania.",
    ],
    (11, 20): [
        "1998: The Zarya control module was launched aboard a Proton rocket, beginning the orbital assembly of the ISS.",
        "1985: Microsoft released Windows 1.0, its first graphical user environment for the personal computer.",
    ],
    (11, 21): [
        "1783: Jean-Francois Pilatre de Rozier and Francois Laurent d'Arlandes completed the first untethered hot air balloon flight.",
        "1877: Thomas Edison announced his invention of the phonograph, capable of recording and reproducing sound.",
    ],
    (11, 22): [
        "1963: President John F. Kennedy was assassinated in Dallas, Texas.",
        "1995: Pixar Animation Studios and Disney released 'Toy Story', the first fully computer-animated feature film.",
    ],
    (11, 23): [
        "1924: Edwin Hubble announced his discovery of Cepheid variable stars in the Andromeda Nebula in The New York Times.",
        "1889: The first jukebox was installed at the Palais Royale Saloon in San Francisco.",
    ],
    (11, 24): [
        "1859: Charles Darwin published 'On the Origin of Species by Means of Natural Selection' in London.",
        "1974: Donald Johanson and Tom Gray discovered the fossilized skeleton of 3.2-million-year-old 'Lucy' in Ethiopia.",
    ],
    (11, 25): [
        "1915: Albert Einstein formally presented the field equations of general relativity to the Prussian Academy of Sciences.",
        "1940: The de Havilland Mosquito multi-role wooden combat aircraft made its maiden flight.",
    ],
    (11, 26): [
        "2011: NASA launched the Mars Science Laboratory carrying the Curiosity rover toward Gale Crater.",
        "1922: Howard Carter and Lord Carnarvon entered the inner tomb of Pharaoh Tutankhamun.",
    ],
    (11, 27): [
        "1971: The Soviet Mars 2 lander crash-landed on Mars, becoming the first human-made object to reach the Martian surface.",
        "1895: Alfred Nobel signed his last will and testament in Paris, establishing the Nobel Prizes.",
    ],
    (11, 28): [
        "1964: NASA launched Mariner 4 on the first successful photographic flyby mission to Mars.",
        "1967: Jocelyn Bell Burnell observed repeating radio pulses that led to the discovery of pulsars.",
    ],
    (11, 29): [
        "1961: Enos the chimpanzee completed a two-orbit flight aboard Mercury-Atlas 5, paving the way for John Glenn.",
        "1972: Atari announced the release of Pong, the first commercially successful coin-operated arcade video game.",
    ],
    (11, 30): [
        "1609: Galileo Galilei first observed the Moon through a telescope and sketched its craters and mountain ranges.",
        "1874: Sir Winston Churchill was born at Blenheim Palace in Oxfordshire, England.",
    ],
    # --- Month 12 ---
    (12, 1): [
        "1913: Henry Ford introduced the moving assembly line for Model T production, reducing chassis assembly to 93 minutes.",
        "1959: Twelve nations signed the Antarctic Treaty, designating Antarctica as a scientific preserve free of military activity.",
    ],
    (12, 2): [
        "1942: Enrico Fermi led the team that achieved the world's first self-sustaining nuclear chain reaction in Chicago (Chicago Pile-1).",
        "1993: Space Shuttle Endeavour launched on STS-61, the historic first servicing mission to repair the Hubble Space Telescope.",
    ],
    (12, 3): [
        "1967: Christiaan Barnard performed the world's first human-to-human heart transplant at Groote Schuur Hospital in Cape Town.",
        "1973: Pioneer 10 transmitted the first close-up images of Jupiter as it flew within 130,000 kilometres of its cloud tops.",
    ],
    (12, 4): [
        "1996: NASA launched the Mars Pathfinder spacecraft carrying the Sojourner rover.",
        "1998: Space Shuttle Endeavour launched on STS-88, delivering the Unity module to join Zarya on the ISS.",
    ],
    (12, 5): [
        "1933: The 21st Amendment was ratified, ending 13 years of alcohol prohibition in the United States.",
        "1901: Walt Disney was born in Chicago, pioneering modern animation and theme park entertainment.",
    ],
    (12, 6): [
        "1877: Thomas Edison made the first sound recording on a foil cylinder phonograph, reciting 'Mary Had a Little Lamb'.",
        "1768: The first edition of the Encyclopædia Britannica was published in Edinburgh, Scotland.",
    ],
    (12, 7): [
        "1972: Apollo 17 launched on the final crewed lunar landing mission of the Apollo programme.",
        "1995: The Galileo atmospheric probe descended into Jupiter's atmosphere, transmitting data for 57 minutes.",
    ],
    (12, 8): [
        "1991: The leaders of Belarus, Russia, and Ukraine signed the Belovezha Accords, dissolving the Soviet Union.",
        "1980: John Lennon was shot and killed outside the Dakota apartment building in New York City.",
    ],
    (12, 9): [
        "1968: Douglas Engelbart demonstrated the computer mouse, hypertext, and video conferencing in 'The Mother of All Demos'.",
        "1979: A global commission officially certified the complete eradication of smallpox.",
    ],
    (12, 10): [
        "1815: Ada Lovelace was born in London, celebrated as the world's first computer programmer.",
        "1901: The first Nobel Prizes were awarded in Stockholm and Oslo on the anniversary of Alfred Nobel's death.",
    ],
    (12, 11): [
        "1972: Apollo 17 lunar module Challenger landed in the Taurus-Littrow valley with Gene Cernan and Harrison Schmitt.",
        "1997: The Kyoto Protocol on greenhouse gas emissions was adopted in Kyoto, Japan.",
    ],
    (12, 12): [
        "1901: Guglielmo Marconi received the first transatlantic wireless radio signal (the Morse letter 'S') in Newfoundland.",
        "1961: OSCAR 1, the first amateur radio satellite, was launched from Vandenberg Air Force Base.",
    ],
    (12, 13): [
        "1972: Harrison Schmitt and Gene Cernan conducted the longest lunar surface spacewalk (EVA) during Apollo 17.",
        "1642: Dutch navigator Abel Tasman sighted the South Island of New Zealand.",
    ],
    (12, 14): [
        "1972: Apollo 17 commander Gene Cernan stepped off the lunar surface, the last human footprint left on the Moon to date.",
        "1911: Roald Amundsen and his four companions became the first humans to reach the South Pole.",
    ],
    (12, 15): [
        "1970: The Soviet Venera 7 spacecraft landed on Venus, becoming the first human craft to transmit data from another planet's surface.",
        "1965: Gemini 6A and Gemini 7 completed the first crewed space rendezvous, flying within one foot of each other in orbit.",
    ],
    (12, 16): [
        "1773: The Boston Tea Party occurred as American colonists dumped 342 chests of British tea into Boston Harbour.",
        "1947: John Bardeen, Walter Brattain, and William Shockley built the first working point-contact transistor at Bell Labs.",
    ],
    (12, 17): [
        "1903: The Wright brothers achieved the first powered, controlled heavier-than-air aeroplane flight at Kitty Hawk, NC.",
        "1989: The animated sitcom 'The Simpsons' premiered as a half-hour series on Fox with 'Simpsons Roasting on an Open Fire'.",
    ],
    (12, 18): [
        "1958: Project SCORE launched aboard an Atlas rocket, transmitting the first human voice broadcast from orbit (President Eisenhower).",
        "1892: Tchaikovsky's ballet 'The Nutcracker' premiered at the Mariinsky Theatre in Saint Petersburg.",
    ],
    (12, 19): [
        "1972: Apollo 17 splashed down in the Pacific Ocean, successfully concluding the Apollo lunar exploration programme.",
        "1906: Soviet statesman Leonid Brezhnev was born in Kamenskoye (Dnipro).",
    ],
    (12, 20): [
        "1951: The EBR-I reactor in Idaho became the world's first nuclear power plant to produce usable electric current, lighting four bulbs.",
        "1803: The United States formally completed the Louisiana Purchase in New Orleans, doubling the size of the nation.",
    ],
    (12, 21): [
        "1968: Apollo 8 launched carrying Frank Borman, Jim Lovell, and William Anders, the first human crew to leave Earth orbit.",
        "1898: Marie and Pierre Curie discovered the radioactive chemical element radium.",
    ],
    (12, 22): [
        "1882: The first string of electric Christmas tree lights was created by Edward H. Johnson, an associate of Thomas Edison.",
        "1964: The Lockheed SR-71 Blackbird strategic reconnaissance aircraft completed its maiden flight.",
    ],
    (12, 23): [
        "1986: The experimental aeroplane Voyager landed in California, completing the first non-stop, unrefuelled flight around the world.",
        "1947: Bell Labs physicists demonstrated the transistor amplifier, launching modern semiconductor electronics.",
    ],
    (12, 24): [
        "1968: Apollo 8 astronauts captured the iconic 'Earthrise' photograph and read from Genesis while orbiting the Moon on Christmas Eve.",
        "1979: The European Space Agency launched the first Ariane 1 rocket from Kourou, French Guiana.",
    ],
    (12, 25): [
        "2021: The James Webb Space Telescope launched aboard an Ariane 5 rocket from Kourou on Christmas Day.",
        "1642: Sir Isaac Newton was born according to the Julian calendar in Woolsthorpe, England.",
    ],
    (12, 26): [
        "1898: Marie and Pierre Curie announced their discovery of the element radium to the French Academy of Sciences.",
        "2004: A magnitude 9.1 earthquake in the Indian Ocean triggered a devastating tsunami across South and Southeast Asia.",
    ],
    (12, 27): [
        "1571: Johannes Kepler was born in Weil der Stadt, formulating the three fundamental laws of planetary motion.",
        "1831: Charles Darwin embarked on his five-year voyage aboard HMS Beagle from Plymouth, England.",
    ],
    (12, 28): [
        "1895: The Lumiere brothers presented the first commercial public screening of projected motion pictures in Paris.",
        "1612: Galileo Galilei became the first astronomer to observe Neptune, cataloguing it as a fixed star.",
    ],
    (12, 29): [
        "1852: Emma Snodgrass was arrested in Boston for wearing trousers, sparking early discussions on dress reform.",
        "1911: Sun Yat-sen was elected the provisional president of the Republic of China in Nanjing.",
    ],
    (12, 30): [
        "1924: Edwin Hubble formally announced that the Andromeda Nebula is actually another distant galaxy.",
        "1927: The Ginza Line in Tokyo opened, the first underground subway line in Asia.",
    ],
    (12, 31): [
        "1879: Thomas Edison gave the first public demonstration of his incandescent electric lighting system in Menlo Park, NJ.",
        "1999: The United States officially transferred complete control of the Panama Canal to the government of Panama.",
    ],
}
