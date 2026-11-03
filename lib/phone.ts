export interface Country {
  iso: string;
  name: string;
  dial: string;
  flag: string;
}

const RAW = `US|United States|1
CA|Canada|1
GB|United Kingdom|44
IN|India|91
AU|Australia|61
NZ|New Zealand|64
IE|Ireland|353
DE|Germany|49
FR|France|33
ES|Spain|34
IT|Italy|39
PT|Portugal|351
NL|Netherlands|31
BE|Belgium|32
LU|Luxembourg|352
CH|Switzerland|41
AT|Austria|43
SE|Sweden|46
NO|Norway|47
DK|Denmark|45
FI|Finland|358
IS|Iceland|354
PL|Poland|48
CZ|Czechia|420
SK|Slovakia|421
HU|Hungary|36
RO|Romania|40
BG|Bulgaria|359
GR|Greece|30
HR|Croatia|385
SI|Slovenia|386
RS|Serbia|381
BA|Bosnia and Herzegovina|387
ME|Montenegro|382
MK|North Macedonia|389
AL|Albania|355
XK|Kosovo|383
EE|Estonia|372
LV|Latvia|371
LT|Lithuania|370
UA|Ukraine|380
BY|Belarus|375
MD|Moldova|373
RU|Russia|7
KZ|Kazakhstan|7
TR|Turkey|90
CY|Cyprus|357
MT|Malta|356
GE|Georgia|995
AM|Armenia|374
AZ|Azerbaijan|994
IL|Israel|972
PS|Palestine|970
LB|Lebanon|961
JO|Jordan|962
SY|Syria|963
IQ|Iraq|964
KW|Kuwait|965
SA|Saudi Arabia|966
YE|Yemen|967
OM|Oman|968
AE|United Arab Emirates|971
QA|Qatar|974
BH|Bahrain|973
IR|Iran|98
AF|Afghanistan|93
PK|Pakistan|92
BD|Bangladesh|880
LK|Sri Lanka|94
NP|Nepal|977
BT|Bhutan|975
MV|Maldives|960
MM|Myanmar|95
TH|Thailand|66
VN|Vietnam|84
LA|Laos|856
KH|Cambodia|855
MY|Malaysia|60
SG|Singapore|65
ID|Indonesia|62
PH|Philippines|63
BN|Brunei|673
TL|Timor-Leste|670
CN|China|86
HK|Hong Kong|852
MO|Macao|853
TW|Taiwan|886
JP|Japan|81
KR|South Korea|82
KP|North Korea|850
MN|Mongolia|976
UZ|Uzbekistan|998
TM|Turkmenistan|993
KG|Kyrgyzstan|996
TJ|Tajikistan|992
MX|Mexico|52
GT|Guatemala|502
BZ|Belize|501
SV|El Salvador|503
HN|Honduras|504
NI|Nicaragua|505
CR|Costa Rica|506
PA|Panama|507
CU|Cuba|53
DO|Dominican Republic|1
JM|Jamaica|1
PR|Puerto Rico|1
HT|Haiti|509
TT|Trinidad and Tobago|1
BS|Bahamas|1
BB|Barbados|1
CO|Colombia|57
VE|Venezuela|58
EC|Ecuador|593
PE|Peru|51
BO|Bolivia|591
CL|Chile|56
AR|Argentina|54
UY|Uruguay|598
PY|Paraguay|595
BR|Brazil|55
GY|Guyana|592
SR|Suriname|597
EG|Egypt|20
LY|Libya|218
TN|Tunisia|216
DZ|Algeria|213
MA|Morocco|212
SD|Sudan|249
SS|South Sudan|211
ET|Ethiopia|251
ER|Eritrea|291
DJ|Djibouti|253
SO|Somalia|252
KE|Kenya|254
UG|Uganda|256
TZ|Tanzania|255
RW|Rwanda|250
BI|Burundi|257
CD|DR Congo|243
CG|Congo|242
GA|Gabon|241
CM|Cameroon|237
NG|Nigeria|234
GH|Ghana|233
CI|Cote d'Ivoire|225
SN|Senegal|221
ML|Mali|223
BF|Burkina Faso|226
NE|Niger|227
TD|Chad|235
MR|Mauritania|222
GM|Gambia|220
GN|Guinea|224
SL|Sierra Leone|232
LR|Liberia|231
TG|Togo|228
BJ|Benin|229
AO|Angola|244
ZM|Zambia|260
ZW|Zimbabwe|263
MW|Malawi|265
MZ|Mozambique|258
MG|Madagascar|261
MU|Mauritius|230
NA|Namibia|264
BW|Botswana|267
ZA|South Africa|27
LS|Lesotho|266
SZ|Eswatini|268
FJ|Fiji|679
PG|Papua New Guinea|675
WS|Samoa|685
TO|Tonga|676
VU|Vanuatu|678
SB|Solomon Islands|677
GU|Guam|1
GL|Greenland|299
FO|Faroe Islands|298
LI|Liechtenstein|423
MC|Monaco|377
AD|Andorra|376
SM|San Marino|378
VA|Vatican City|379`;

function flagFor(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export const COUNTRIES: Country[] = RAW.split("\n").map((line) => {
  const [iso, name, dial] = line.split("|");
  return { iso, name, dial, flag: flagFor(iso) };
});

export const DEFAULT_COUNTRY = "US";

export function findCountry(iso: string): Country | undefined {
  return COUNTRIES.find((c) => c.iso === iso);
}

export function normalizePhone(iso: string, input: string): string | null {
  const country = findCountry(iso);
  if (!country) {
    return null;
  }
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length < 4 || country.dial.length + digits.length > 15) {
    return null;
  }
  return `+${country.dial}${digits}`;
}

export function splitPhone(value: string | null | undefined): { iso: string; number: string } | null {
  if (!value || !value.startsWith("+")) {
    return null;
  }
  const digits = value.slice(1).replace(/\D/g, "");
  let best: Country | null = null;
  for (const country of COUNTRIES) {
    if (digits.startsWith(country.dial) && (!best || country.dial.length > best.dial.length)) {
      best = country;
    }
  }
  if (!best) {
    return null;
  }
  return { iso: best.iso, number: digits.slice(best.dial.length) };
}

export function countryName(value: string | null | undefined): string {
  const code = (value ?? "").trim();
  if (!/^[A-Za-z]{2}$/.test(code)) {
    return code;
  }
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase());
    if (name && name !== code.toUpperCase()) {
      return name;
    }
  } catch {}
  return findCountry(code.toUpperCase())?.name ?? code;
}
