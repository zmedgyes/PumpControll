
/*
 * Author: JP Meijers
 * 30 September 2016
 */

#include <SoftwareSerial.h>
#include <EEPROM.h>
#include <AESLib.h>

struct DeviceObject {
  byte id;
  byte deviceKey[16];
  byte serverKey[16];
  char passphrase[13];
};


SoftwareSerial loraSerial(10, 11);

String str;
DeviceObject dev;
int token =0;
int devObjAddress = 0;
String bootCmd = "";

const int sensorIn = A0;
const int measWindowSize = 1000;
int mVperAmp = 66; // use 100 for 20A Module and 66 for 30A Module
double Voltage = 0;
double VRMS = 0;
double AmpsRMS = 0;

void setup() {
  //output LED pin
  pinMode(13, OUTPUT);
  led_off();
  
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
      EEPROM.put(devObjAddress,dev.id);
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
      EEPROM.put(devObjAddress, dev);
     }
  }
  EEPROM.get(devObjAddress,dev);
  Serial.println(byteToHEXString(dev.id));
  Serial.println(String(dev.passphrase));
  
    //Radio Reset
  pinMode(12, OUTPUT);
  digitalWrite(12, 0);
  delay(100);
  digitalWrite(12, 1);
  delay(100);
  
  loraSerial.begin(9600);
  loraSerial.setTimeout(1000);
  lora_autobaud();
  
  led_on();
  delay(1000);
  led_off();

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
  String cmd = "registertest 01"+byteToHEXString(dev.id)+aesEncriptAndToHexString(dev.serverKey,packRegisterData(buf));
  Serial.println(cmd);
  delay(1000);
}

void loop() {
  
  //currentMeas
  Voltage = getVPP(measWindowSize);
  VRMS = (Voltage/2.0) *0.707; 
  AmpsRMS = (VRMS * 1000)/mVperAmp;
  //Serial.println(floatToHEXString(AmpsRMS));
  //sendMessage(0,2,floatToHEXString(AmpsRMS));
  byte buf[16] = {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0};
  byte* pack = packCurrentData(0.5f,buf);
  String ret ="";
  String key = "";
  for(int i =0; i<16; i++){
    ret += byteToHEXString(pack[i]);
    key += byteToHEXString(dev.serverKey[i]);
  }
  Serial.println(ret);
  Serial.println(key);
  Serial.println("aestest 01"+byteToHEXString(dev.id)+aesEncriptAndToHexString(dev.deviceKey,pack));
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

void toggle_led()
{
  digitalWrite(13, !digitalRead(13));
}

void led_on()
{
  digitalWrite(13, 1);
}

void led_off()
{
  digitalWrite(13, 0);
}
void processMsg(String msg){
  byte targetId = HEXStringToByte(msg.substring(0,2));
  byte fromId = msg.substring(2,4).toInt();
  int msgType = msg.substring(4,6).toInt();
  String msgBody = msg.substring(6);
  if(targetId == dev.id){
    Serial.println("own cmd:"+msgBody);
    //test toggle led
    if(msgType == 1){
      Serial.println("toggle led");
      toggle_led();
      delay(500);
      toggle_led();
    }
  }
  else{
    Serial.println("foreign cmd to:"+targetId);
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
  ret[0] = 0;
  for(int i = 0; i < 13; i++){
    ret[i+1] = dev.passphrase[i];
  }
  return ret;
}
byte* packHearthBeat(byte* ret){
  ret[0] = 1;
   *((int *) &(ret[1])) = token;
  return ret;
}
byte* packCurrentData(float data, byte* ret){
  ret[0] = 2;
  *((int *) &(ret[1])) = token;
  *((float *) &(ret[3])) = data;
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
       readValue = analogRead(sensorIn);
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
