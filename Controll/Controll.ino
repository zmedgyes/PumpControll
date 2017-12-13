
/*
 * Author: JP Meijers
 * 30 September 2016
 */

#include <SoftwareSerial.h>
#include <EEPROM.h>
#include <AESLib.h>

#define LED_PIN 13

#define TRIAC_PIN 6

#define HALL_PIN A0
#define HALL_mVperAmp 66; //mV to A conversion factor to 30A Hall-module

#define LORA_PIN_RX 10
#define LORA_PIN_TX 11
#define LORA_PIN_RST 12

#define DEVICE_OBJECT_ADDRESS 0

#define SERVER_ADDRESS 1
#define SERVER_REGISTRATION_ADDRESS 2
#define BROADCAST_ADDRESS 0

#define SEND_MSG_CODE_REG 0
#define SEND_MSG_CODE_HB 1
#define SEND_MSG_CODE_CUR 2
#define SEND_MSG_CODE_ERR 0

#define RECV_MSG_CODE_TOK 0
#define RECV_MSG_CODE_LED 1
#define RECV_MSG_CODE_TRI 2
#define RECV_MSG_CODE_SET_MAXC 3
#define RECV_MSG_CODE_SET_MINC 4

#define ERROR_CODE_OVERCURRENT 0
#define ERROR_CODE_UNDERCURRENT 1
#define ERROR_CODE_FALSE_CURRENT 2
#define ERROR_CODE_OTHER 3

struct DeviceObject {
  byte id;
  byte deviceKey[16];
  byte serverKey[16];
  char passphrase[13];
};

String str;
DeviceObject dev;
int token = 0;
String bootCmd = "";

const int measWindowSize = 100; //áram mintavételezési időablak [ms]
int defaultLoRaWDT = 10000; //LoRa WatchDog Timeout [ms]
int fastLoRaWDT = 1000; //LoRa WatchDog Timeout bekapsolt pumpa mellett[ms]
float minWorkingCurrent = 2.0;
float maxWorkingCurrent = 10.0;
float AmpsRMS = 0;
bool pumpOn = false;

uint32_t lastHearthBeat = 0;
uint32_t hearthBeatInterval = 10000;

SoftwareSerial loraSerial(LORA_PIN_RX, LORA_PIN_TX);

void setup() {
  //output LED pin
  led_init();
  led_off();

  //triac
  triac_init();
  triac_off();
  
  // Open serial communications and wait for port to open:
  Serial.begin(57600);
  Serial.println("connected");
  Serial.setTimeout(5000);
  Serial.println("BootCommand for 5sec");
  bootCmd = Serial.readStringUntil('\n');
  if(bootCmd == ""){
    Serial.println("BootCommand ended");
  }
  else{
     if ( bootCmd.indexOf("setid") == 0 ){
      dev.id = HEXStringToByte(bootCmd.substring(6));
      EEPROM.put(DEVICE_OBJECT_ADDRESS,dev.id);
     }
     else if ( bootCmd.indexOf("init") == 0){
      dev.id = HEXStringToByte(bootCmd.substring(5,7));
      String dKeyString = bootCmd.substring(8,40);
      String sKeyString = bootCmd.substring(41,73);
      for(int i = 0; i< 16; i++){
        dev.deviceKey[i]=HEXStringToByte(dKeyString.substring(i*2,i*2+2));
        dev.serverKey[i]=HEXStringToByte(sKeyString.substring(i*2,i*2+2));
      }
      //+1 a stringlezáró miatt
      bootCmd.substring(74,87).toCharArray(dev.passphrase,14);
      EEPROM.put(DEVICE_OBJECT_ADDRESS, dev);
     }
  }
  EEPROM.get(DEVICE_OBJECT_ADDRESS,dev);

  //DEBUG
  Serial.println(byteToHEXString(dev.id));
  Serial.println(String(dev.passphrase));
  //DEBUG
  
  //Radio reset
  lora_reset();

  //Radio start
  
  loraSerial.begin(9600);
  loraSerial.setTimeout(1000);
  lora_autobaud();

  //DEBUG
  led_on();
  delay(1000);
  led_off();
  //DEBUG

  //Radio setup
  Serial.println("Initing LoRa");
  loraSerial.listen();
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  loraSerial.println("sys get ver");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("mac pause");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
//  loraSerial.println("radio set bt 0.5");
//  wait_for_ok();
  
  loraSerial.println("radio set mod lora");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set freq 869100000");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set pwr 14");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set sf sf7");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set afcbw 41.7");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set rxbw 125");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
//  loraSerial.println("radio set bitrate 50000");
//  wait_for_ok();
  
//  loraSerial.println("radio set fdev 25000");
//  wait_for_ok();
  
  loraSerial.println("radio set prlen 8");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set crc on");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set iqi off");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set cr 4/5");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  //loraSerial.println("radio set wdt 60000"); //disable for continuous reception
  loraSerial.println("radio set wdt 10000"); //disable for continuous reception
  loraSerial.println("radio set wdt "+String(defaultLoRaWDT));
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set sync 12");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  
  loraSerial.println("radio set bw 125");
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);

  //send register
  byte buf[16] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
  sendMessage(SERVER_REGISTRATION_ADDRESS,aesEncriptAndToHexString(dev.serverKey,packRegisterData(buf)));
  
  //DEBUG
  String cmd = "registertest 01"+byteToHEXString(dev.id)+aesEncriptAndToHexString(dev.serverKey,packRegisterData(buf));
  Serial.println(cmd);
  //DEBUG
  
  delay(1000);
}

void loop() {
  byte buf[16] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
  byte* pack;
  uint32_t currentTime = millis();

  //HEARTHBEAT
  //overflow (~50nap)
  if(lastHearthBeat > currentTime){
    lastHearthBeat = currentTime;
    pack = packHearthBeat(buf);
    sendMessage(SERVER_ADDRESS,aesEncriptAndToHexString(dev.deviceKey,pack));
  }
  else if((currentTime-lastHearthBeat) > hearthBeatInterval){
    lastHearthBeat = currentTime;
    pack = packHearthBeat(buf);
    sendMessage(SERVER_ADDRESS,aesEncriptAndToHexString(dev.deviceKey,pack));
  }
  
  //CURRENT AND PUMP ERROR
  AmpsRMS = getAmpsRMS();
  
  if(pumpOn){
    if(AmpsRMS > maxWorkingCurrent){
      triac_off();
      pack = packErrorMessage(ERROR_CODE_OVERCURRENT,buf);
      sendMessage(SERVER_ADDRESS,aesEncriptAndToHexString(dev.deviceKey,pack));
    }
    else if(AmpsRMS < minWorkingCurrent){
      pack = packErrorMessage(ERROR_CODE_UNDERCURRENT,buf);
      sendMessage(SERVER_ADDRESS,aesEncriptAndToHexString(dev.deviceKey,pack));
    }
  }
  else{
    if(AmpsRMS > minWorkingCurrent){
      pack = packErrorMessage(ERROR_CODE_FALSE_CURRENT,buf);
      sendMessage(SERVER_ADDRESS,aesEncriptAndToHexString(dev.deviceKey,pack));
    }
  }
  
  pack = packCurrentData(AmpsRMS,buf);
  
  //DEBUG
  String ret ="";
  String key = "";
  for(int i =0; i<16; i++){
    ret += byteToHEXString(pack[i]);
    key += byteToHEXString(dev.serverKey[i]);
  }
  Serial.println(ret);
  Serial.println(key);
  Serial.println("aestest 01"+byteToHEXString(dev.id)+aesEncriptAndToHexString(dev.deviceKey,pack));
  //DEBUG

  sendMessage(SERVER_ADDRESS,aesEncriptAndToHexString(dev.deviceKey,pack));

  //WAIT FORM MESSAGE
  Serial.println("waiting for a message");
  loraSerial.println("radio rx 0"); //wait for 60 seconds to receive
            
  str = loraSerial.readStringUntil('\n');
  if ( str.indexOf("ok") == 0 ){
  
    str = String("");
    while(str=="")
    {
      str = loraSerial.readStringUntil('\n');
    }
    if ( str.indexOf("radio_rx") == 0 )
    {
      Serial.println(str);
      processMsg(str.substring(10));
    }
    else
    {
      Serial.println("Received nothing");
    }
  }
  else
  {
    Serial.println("radio not going into receive mode");
    delay(1000);
  }
}

void lora_autobaud()
{
  String response = "";
  while (response=="")
  {
    delay(1000);
    loraSerial.write((byte)0x00);
    loraSerial.write(0x55);
    loraSerial.println();
    loraSerial.println("sys get ver");
    response = loraSerial.readStringUntil('\n');
  }
}
 void lora_reset(){
  pinMode(LORA_PIN_RST, OUTPUT);
  digitalWrite(LORA_PIN_RST, LOW);
  delay(100);
  digitalWrite(LORA_PIN_RST, HIGH);
  delay(100);
 }
/*
 * This function blocks until the word "ok\n" is received on the UART,
 * or until a timeout of 3*5 seconds.
 */
int wait_for_ok()
{
  str = loraSerial.readStringUntil('\n');
  if ( str.indexOf("ok") == 0 ) {
    return 1;
  }
  else return 0;
}

void led_init(){
  pinMode(LED_PIN, OUTPUT);
}
void toggle_led()
{
  digitalWrite(LED_PIN, !digitalRead(LED_PIN));
}

void led_on()
{
  digitalWrite(LED_PIN, HIGH);
}

void led_off()
{
  digitalWrite(LED_PIN, LOW);
}
void triac_init(){
  pinMode(TRIAC_PIN, OUTPUT);
}
void triac_on(){
  loraSerial.println("radio set wdt "+String(fastLoRaWDT));
  if(wait_for_ok()){
    pumpOn = false;
    digitalWrite(TRIAC_PIN, HIGH);
  }
  else{
    byte buf[16] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
    byte* pack = packErrorMessage(ERROR_CODE_OTHER,buf);
    sendMessage(SERVER_ADDRESS,aesEncriptAndToHexString(dev.deviceKey,pack));
  }
}
void triac_off(){
  pumpOn = false;
  digitalWrite(TRIAC_PIN, LOW);
  loraSerial.println("radio set wdt "+String(defaultLoRaWDT));
  wait_for_ok();
}

void processMsg(String msg){
  byte targetId = HEXStringToByte(msg.substring(0,2));
  byte fromId = HEXStringToByte(msg.substring(2,4));
  //broadcast message
  byte message[16];
  if(targetId == BROADCAST_ADDRESS){
    aesDecryptAndToByteArray(dev.serverKey, msg.substring(4,36),message);
    //server token
    if(message[0] == RECV_MSG_CODE_TOK){
      token = *((int*)(&message[1]));
    }
    else if(message[0] == RECV_MSG_CODE_SET_MAXC){
      maxWorkingCurrent = *((float*)(&message[1]));
    }
    else if(message[0] == RECV_MSG_CODE_SET_MINC){
      minWorkingCurrent = *((float*)(&message[1]));
    }
  }
  //own message
  else if(targetId == dev.id){
    aesDecryptAndToByteArray(dev.deviceKey, msg.substring(4,36),message);
    //led on/off
    if(message[0] == RECV_MSG_CODE_LED){
      if(message[1]){
        led_on();
      }
      else{
        led_off();
      }
    }
    //pump on/off
    else if(message[0] == RECV_MSG_CODE_TRI){
      if(message[1]){
        led_on();
      }
      else{
        led_off();
      }
    }
    else if(message[0] == RECV_MSG_CODE_SET_MAXC){
      maxWorkingCurrent = *((float*)(&message[1]));
    }
    else if(message[0] == RECV_MSG_CODE_SET_MINC){
      minWorkingCurrent = *((float*)(&message[1]));
    }
  }
  //foreign message
  else{
  }
}

String aesEncriptAndToHexString(byte* key, byte* data){
  String ret ="";
  aes128_enc_single(key, data);
  for(int i =0; i<16; i++){
    ret += byteToHEXString(data[i]);
  }
  return ret;
}

byte* aesDecryptAndToByteArray(byte* key, String data,byte* ret){
  for(int i = 0; i < 16; i++){
    ret[i] = HEXStringToByte(data.substring(i*2,i*2+2));
  }
  aes128_dec_single(key, ret);
  return ret;
}

byte* packRegisterData(byte* ret){
  ret[0] = SEND_MSG_CODE_REG;
  for(int i = 0; i < 13; i++){
    ret[i+1] = dev.passphrase[i];
  }
  return ret;
}
byte* packHearthBeat(byte* ret){
  ret[0] = SEND_MSG_CODE_HB;
   *((int *) &(ret[1])) = token;
  return ret;
}
byte* packCurrentData(float data, byte* ret){
  ret[0] = SEND_MSG_CODE_CUR;
  *((int *) &(ret[1])) = token;
  *((float *) &(ret[3])) = data;
  return ret;
}
byte* packErrorMessage(byte code, byte* ret){
  ret[0] = SEND_MSG_CODE_ERR;
  *((int *) &(ret[1])) = token;
  ret[3]=code;
  return ret;
}
String byteToHEXString(byte b){
  int upper = (int)((b & 0xF0) >> 4);
  int lower = (int)(b & 0x0F);
  return String(upper,HEX)+String(lower,HEX);
}
byte HEXStringToByte(String str){
  return (convertCharToHex(str.charAt(0)) << 4)+convertCharToHex(str.charAt(1));
}
byte convertCharToHex(char ch)
{
  byte returnType;
  switch(ch)
  {
    case '0':
    returnType = 0;
    break;
    case  '1' :
    returnType = 1;
    break;
    case  '2':
    returnType = 2;
    break;
    case  '3':
    returnType = 3;
    break;
    case  '4' :
    returnType = 4;
    break;
    case  '5':
    returnType = 5;
    break;
    case  '6':
    returnType = 6;
    break;
    case  '7':
    returnType = 7;
    break;
    case  '8':
    returnType = 8;
    break;
    case  '9':
    returnType = 9;
    break;
    case  'A':
    returnType = 10;
    break;
    case  'B':
    returnType = 11;
    break;
    case  'C':
    returnType = 12;
    break;
    case  'D':
    returnType = 13;
    break;
    case  'E':
    returnType = 14;
    break;
    case  'F' :
    returnType = 15;
    break;
    case  'a':
    returnType = 10;
    break;
    case  'b':
    returnType = 11;
    break;
    case  'c':
    returnType = 12;
    break;
    case  'd':
    returnType = 13;
    break;
    case  'e':
    returnType = 14;
    break;
    case  'f' :
    returnType = 15;
    break;
    default:
    returnType = 0;
    break;
  }
  return returnType;
}
void sendMessage(byte toId, String hexContent){
  String msgBody = byteToHEXString(toId) + byteToHEXString(dev.id) + hexContent;
  Serial.println("Sndmsg: "+msgBody);
  loraSerial.println("radio tx "+msgBody);
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
  str = loraSerial.readStringUntil('\n');
  Serial.println(str);
}
float getVPP(int windowSize)
{
  float result;
  
  int readValue;             //value read from the sensor
  int maxValue = 0;          // store max value here
  int minValue = 1024;          // store min value here
   uint32_t start_time = millis();
   while((millis()-start_time) < windowSize)
   {
       readValue = analogRead(HALL_PIN);
       // see if you have a new maxValue
       if (readValue > maxValue) 
       {
           /*record the maximum sensor value*/
           maxValue = readValue;
       }
       if (readValue < minValue) 
       {
           /*record the maximum sensor value*/
           minValue = readValue;
       }
   }
   // Subtract min from max
   result = ((maxValue - minValue) * 5.0)/1024.0;
      
   return result;
 }
 float getAmpsRMS(){
    float Voltage = getVPP(measWindowSize);
    float VRMS = (Voltage/2.0) *0.707; 
    return (VRMS * 1000)/HALL_mVperAmp;
 }

