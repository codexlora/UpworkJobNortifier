## Upwork New Jobs Notifier
Notify new jobs using the Upwork RSS and OS notifications

![Windows Notification](https://i.ibb.co/PF7QvK4/Captura-de-pantalla-2024-05-25-034541.png)

**Start with**

    node --env-file=.env .\server.js

You must store your own `UPWORK_RSS` (from upwork search page) inside the .env file
### Requirements
 - Node >= v20.6.0
 - Mongodb
	 - DB=**upworknotificator**
	 - Collection=**jobs**