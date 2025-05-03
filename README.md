<a href="https://wakatime.com/badge/user/5cb09b6f-afc0-48f6-965a-2d8192ae1d89/project/7e224720-0194-4d45-83c7-b096e48c291b"><img src="https://wakatime.com/badge/user/5cb09b6f-afc0-48f6-965a-2d8192ae1d89/project/7e224720-0194-4d45-83c7-b096e48c291b.svg" alt="wakatime"></a>









Updates - Install axios

`npm install axios`

`pip install djangorestframework`

## Models

- Database
  - MongoDb
  - Postgress
  - MYSQL
  - Redis (GIS)
- Payment.
  - MPESA, Banking (Equity, Coop, KCB)
  -
- SMS
  - AfricasTalking
- Flood Monitoring
  - Linear Regression,
  -
- GIS - (New comer)
- Analysis.
- Invoicing
- Prediction
- User Auth
- Subscription management

## Models to work on 

<img align="center" src="auth/methods/models.png" alt="work log" height="auto" width="auto" />


## TODOs

- Reduce subscription plans to three (Trial, Premium and Corporate)
- Redesign Login/Register pop up in new folder(login)
- Payment folder


## Work Log 
<img align="center" src="auth/methods/work_plan_flowchart.png" alt="work log" height="auto" width="auto" />



## Flow Chart 

<img align="center" src="public/assets/img/flood_monitoring_flow_diagram.png" alt="gautamkrishnar" height="auto" width="auto" />



## Gunicorn to always run 

Supervisor Configuration /etc/supervisor/conf.d/floodsys.conf:

  [program:floodsys]

  command=/home/freak/.venv/bin/gunicorn --config /home/freak/Documents/floodsys/auth/gunicorn_config.py auth.wsgi:application

  directory=/home/freak/Documents/floodsys/auth

  user=your_user

  autostart=true

  autorestart=true

  stderr_logfile=/var/log/supervisor/floodsys.err.log

  stdout_logfile=/var/log/supervisor/floodsys.out.log


`sudo supervisorctl reread`

`sudo supervisorctl update`

`sudo supervisorctl start floodsys`