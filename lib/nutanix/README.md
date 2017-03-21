## ntx-on-demand

Simplest little customer portal that will auth users and spin up a canned VM for them to interact with.  


### build details

#### customize the properties in server.js!


#### vm clone prep script

#!/bin/bash
#clean yum cache
/usr/bin/yum clean all
#remove udev hardware rules
/bin/rm -f /etc/udev/rules.d/70*
#remove nic mac addr and uuid from ifcfg scripts
/bin/sed -i '/^\(HWADDR\|UUID\)=/d' /etc/sysconfig/network-scripts/ifcfg-eth0
#remove host keys (important step security wise. similar to system GUID in Windows)
/bin/rm -f /etc/ssh/*key*
#engage logrotate to shrink logspace used
/usr/sbin/logrotate -f /etc/logrotate.conf
#and lets shutdown
init 0 




#### cloud init script
#doesnt work and i dont know why
#yaml, so tabs matter!

write_files:
-   content: |
        # testing

        test
    path: /etc/test
    permissions: '0644'
    owner: root:root
    


#### setup systemd for node
#create the following file /etc/systemd/system/node-5000.service with the content below

[Service]
ExecStart=/usr/bin/node /opt/app/app.js
Restart=always
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=node-app-1
User=your_app_user_name
Group=your_app_user_name
Environment=NODE_ENV=production PORT=5000

[Install]
WantedBy=multi-user.target

#### configure systemd
systemctl start node-5000
systemctl enable node-5000