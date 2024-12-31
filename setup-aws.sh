# AWS Infrastructure Setup Script

## setup-aws.sh
#!/bin/bash

# Create ECR repository
aws ecr create-repository \
    --repository-name card-game \
    --image-scanning-configuration scanOnPush=true

# Create EC2 security group
aws ec2 create-security-group \
    --group-name card-game-sg \
    --description "Security group for card game application"

# Add inbound rules
aws ec2 authorize-security-group-ingress \
    --group-name card-game-sg \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-name card-game-sg \
    --protocol tcp \
    --port 3005 \
    --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
    --group-name card-game-sg \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0

# Launch EC2 instance
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --count 1 \
    --instance-type t2.micro \
    --key-name your-key-pair \
    --security-groups card-game-sg \
    --user-data file://ec2-user-data.sh